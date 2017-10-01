var _ = require('lodash');
var fs = require('fs');
var XLSX = require('xlsx');
var util = require('util');
var argv = require('argv');
const path = require('path');
var mkdirp = require('mkdirp');
var fetch = require('node-fetch');
var base64Img = require('base64-img');
var dateFormat = require('dateformat');
var PythonShell = require('python-shell');

var upscall = require('./upscall.js');
var UpsError = require('./upserror.js').UpsError;

var args = argv.option([
  {
    name: 'date',
    short: 'd',
    type: 'string',
    description: 'Speicifiy the date for reading Groupon-Upload excel file',
  },
  {
    name: 'debug',
    short: 'b',
    type: 'boolean',
    description: 'Specify to set debug mode to true',
  }
]).run();

var DEBUG_MODE = false;
if (args.options.hasOwnProperty('debug')) {
  DEBUG_MODE = true;
  console.log('Debug Mode On');
}

var process_date = dateFormat(new Date(), "yyyymmdd");
if (args.options.hasOwnProperty('date')) {
  process_date = args.options.date;
}

//const soundbot_base_dir = 'C:\\Users\\TC710-Admin\\Desktop\\ayou7995\\SoundBot';
//const groupon_ups_upload_dir = 'C:\\Users\\TC710-Admin\\Dropbox\\GrouponOrders\\groupon_ups_upload';
//const python_script_path = path.join(soundbot_base_dir, 'create_label/src/');
//const label_dir = path.join('C:\\Users\\TC710-Admin\\Dropbox\\GrouponOrders\\labels', process_date);
//const image_dir = path.join(label_dir, 'image');
//const python_path = 'C:\\\\Users\\TC710-Admin\\AppData\\Local\\Programs\\Python\\Python36\\python.exe';

const soundbot_base_dir = '/home/ayou7995/NTUEE/8th_semester/SoundBot/';
const groupon_ups_upload_dir = path.join(soundbot_base_dir, 'garbagecan/groupon_ups_upload/');
const label_dir = path.join(soundbot_base_dir, 'create_label', 'labels', process_date);
const image_dir = path.join(label_dir, 'image');
const python_path = '/usr/bin/python/';
const python_script_path = path.join(soundbot_base_dir, 'create_label/src/');

mkdirp(label_dir, function (err) {
  if (err) console.error(err);
});

mkdirp(image_dir, function (err) {
  if (err) console.error(err);
});

function readXlsx(workbook){
  let upload_data, parentid_data, total_data = [];
  if ( workbook.SheetNames.indexOf('Upload_Data') >= 0 ) {
    let upload_data_worksheet = workbook.Sheets['Upload_Data'];
    upload_data = XLSX.utils.sheet_to_json(upload_data_worksheet);
  }
  if (workbook.SheetNames.indexOf('Parent_ID_Order') >= 0 ) {
    let parentid_order_worksheet = workbook.Sheets['Parent_ID_Order'];
    parentid_data = XLSX.utils.sheet_to_json(parentid_order_worksheet); 
  }
  Array.prototype.push.apply(total_data, upload_data);
  Array.prototype.push.apply(total_data, parentid_data);
  console.log('upload_data_tab containing ' + upload_data.length.toString() + ' orders!');
  console.log('parentid_order_tab containing ' + parentid_data.length.toString() + ' orders!');
  return total_data;
}

function processBatch(filename){
  let workbook;
  try {
    workbook = XLSX.readFile(filename);
  }
  catch(err){ 
    if (err instanceof Error) {
      if (DEBUG_MODE) console.log(err);
      else console.log(err.name + ': ' + err.message);
    }
    process.exit(1);
  }
  let xlsxdata = readXlsx(workbook);

  let row_count = 0, total_data = xlsxdata.length;
  let stats = {'total_data': total_data, 'success': 0, 'faillist': []};
  labelLoop(stats, total_data);
  function labelLoop(stats, total_data){
    let obj = xlsxdata[row_count];
    console.log('[ '+obj.index_ref2+' ]');

    if (obj.service !== 'Error') {
      createLabel(obj, stats, total_data);
    } 
    if(++row_count == xlsxdata.length){
      return stats;
    }
    setTimeout(()=>{labelLoop(stats, total_data)}, 3000);
  }
}
processBatch(path.join(groupon_ups_upload_dir, 'Groupon_'.concat(process_date).concat('.xlsx')));

function parseJson(response) {
  if ( response.status < 200 || response.status >= 300 ) {
    throw Error(response.statusText);
  }
  let contentType = response.headers.get("content-type");
  if(contentType && contentType.includes("application/json")) {
    return response.json();
  }
  throw new TypeError("Oops, response from " + repsonse.url + ' is not in JSON format');
}

function updateOrder(obj, address_key) {
  obj.shipment_address_street = address_key.AddressLine;
  obj.shipment_address_city = address_key.PoliticalDivision2;
  obj.shipment_address_state = address_key.PoliticalDivision1;
  //obj.shipment_address_postal_code = address_key.PostcodePrimaryLow;
  obj.shipment_address_country = address_key.CountryCode;
}

async function createLabel (obj, stats, total) {
  let index_ref2 = obj.index_ref2;
  try {
    let response;
    // UPS Address Validation
    response = await upscall.validateAddress( createUnsureAddrInfo(obj) );
    response = await parseJson(response);
    let address_key = await upscall.handleAddressValidationResponse(index_ref2, response, DEBUG_MODE); 
    updateOrder(obj, address_key);

    // One phase Shipment Request 
    let tracking_number, graphic_image;
    response = await upscall.confirmShipment( createShippingLabelInfo(obj) );
    response = await parseJson(response);
    label_info = await upscall.handleShipmentResponse(index_ref2, response, DEBUG_MODE);
    tracking_number = (obj.service==='Expedited Mail Innovations' 
                       ? label_info.uspspicnumber 
                       : label_info.tracking_number);
    graphic_image = label_info.graphic_image;

    // Complete Shipping Label
    let shippingLabelPath = '', callShippingLabelTime = 0;
    while( callShippingLabelTime < 5 && ! Boolean(shippingLabelPath) ) {
      callShippingLabelTime++;
      shippingLabelPath = await completeShippingLabel(obj, graphic_image); 
      if( callShippingLabelTime === 5 && ! Boolean(shippingLabelPath) ) {
        throw new UpsError(index_ref2 ,'Fail to complete shipping label');
      }
    }

    // Complete Packing Slip
    let packingSlipPath = '', callPackingSlipTime = 0;
    while( callPackingSlipTime < 5 && ! Boolean(packingSlipPath) ) {
      callPackingSlipTime++;
      packingSlipPath = await completePackingSlip(obj, tracking_number);
      if( callPackingSlipTime === 5  && ! Boolean(packingSlipPath) ) {
        throw new UpsError(index_ref2, 'Fail to complete packing slip');
      }
    }

    // Combine shipping label and packing slip into pdf
    let pdf_name = path.join(label_dir, index_ref2.concat('_').concat(obj.Parent_ID).concat('.pdf')); // ex. 00001_123456789.pdf
    let isCombinationDone = false, callCombinationTime = 0;
    while( callCombinationTime < 5 && ! isCombinationDone ) {
      callCombinationTime++;
      isCombinationDone = await combine2PDF(shippingLabelPath, packingSlipPath, pdf_name);
      if( callCombinationTime === 5 && ! isCombinationDone ) {
        throw new UpsError(index_ref2, 'Fail to combine shipping label and packing slip');
      }
    }
    console.log('[ ' + index_ref2 + ' ] process done!!!!');
    stats['success'] ++;
    outputStats(stats, total);
  }
  catch (err) {
    if(DEBUG_MODE) console.log(err);
    else{
      if ( err instanceof UpsError ) {
        console.log('[ '+ err.index+' ]', err.name, err.message, '-', err.code, err.description);
      } else { 
        console.log(err.name, err.message);
      }
    }
    stats['faillist'].push(err.index);
    outputStats(stats, total);
  }
}

function outputStats(stats, total){
  if(stats['success']+stats['faillist'].length == total){
    console.log(stats);
  }
}

function completeShippingLabel(obj, graphic_image) {
  /*  input :
   *    obj - order object
   *    graphic_image : png format BASE 64 string */
  let shipping_label_name = obj.index_ref2.concat('-sl');
  let decode_string = 'data:image/png;base64,'.concat(graphic_image);
  let shipping_label_path = base64Img.imgSync(decode_string, image_dir, shipping_label_name);
  let add_reference_options = {
    //mode: 'text',
    //pythonPath: python_path,
    //scriptPath: python_script_path,
    args: [
      obj['fulfillment_line_item_id_ref1'], 
      obj['Cost Center'], //'SoundBotGroupon',
      obj['MasterSalesOrderNum_ref5'],
      obj['SKU_QTY'],
      obj['packing_package_type'],
      shipping_label_path
    ]
  };
  return new Promise( (resolve, reject) => {
    PythonShell.run('add_reference.py', add_reference_options, function (err, results) {
      if (err) reject('completeShippingLabel fail');
      resolve(shipping_label_path);
    })
  });
}
function completePackingSlip(obj, tracking_number) {
  let packing_slip_path = path.join(image_dir,obj.index_ref2.concat('-ps.png'));
  let create_packingslip_options = {
    //mode: 'text',
    //pythonPath: python_path,
    //scriptPath: python_script_path,
    args: [
      'item order date',
      obj.MasterSalesOrderNum_ref5,
      obj.Parent_ID,
      obj.shipment_address_name,
      obj.shipment_address_street,
      obj.shipment_address_street_2,
      obj.shipment_address_city,
      obj.shipment_address_state,
      obj.shipment_address_postal_code,
      'BEST',
      obj.fulfillment_line_item_id_ref1,
      'item upc',
      obj.merchant_sku_item_ref4,
      'item name',
      obj.Qty,
      'item gift message',
      tracking_number,
      packing_slip_path
    ]
  };
  return new Promise( (resolve,reject) => {
    PythonShell.run('create_packing_slip.py', create_packingslip_options, function (err, results) {
      if (err) reject(err);
      resolve(packing_slip_path);
    })
  });
}

function combine2PDF(slPath, psPath, filename){
  let combine_to_pdf_options = {
    //mode: 'text',
    //pythonPath: python_path,
    //scriptPath: python_script_path,
    args: [
      slPath,
      psPath,
      filename
    ]
  };
  return new Promise( (resolve,reject) => {
    PythonShell.run('combine2pdf.py', combine_to_pdf_options, function (err, results) {
      if (err) reject(err);
      resolve(true);
    })
  });
}

function createUnsureAddrInfo (order) {
  return {
    request_option: '3',
    name: order.shipment_address_name,
    address_line_1: order.shipment_address_street,
    address_line_2: order.shipment_address_street_2,
    country: order.shipment_address_country,
    state: order.shipment_address_state,
    city: order.shipment_address_city,
    postal_code: order.shipment_address_postal_code,
  }
}

function createShippingLabelInfo(obj) {
  var slInfo = new ShippingLabelInfo();
  var data = slInfo.buildBasic(obj);
  data['shipper'] = slInfo.buildShipper();
  data['ship_from'] = slInfo.buildShipfrom();
  data['ship_to'] = slInfo.buildShipto(obj);
  data['package'] = slInfo.buildPackages(obj);
  return data;
}

function ShippingLabelInfo() {

  this.buildBasic = function(obj) {
    let data = {
      saturday_delivery : true,
    }
    if (obj.service == 'SurePost 1 lb or Greater') {
      data['service_code'] = '93';
    } else if (obj.service == 'Ground') {
      data['service_code'] = '03';
    } else if (obj.service == 'Expedited Mail Innovations') {
      data['service_code'] = 'M4';
      data['uspsendorsement'] = '1', // 1 = Return Service Requested
      data['subclassification'] = 'IR';
      data['cost_center'] = 'SOUNDBOTGROUPON';
      data['packageid'] = obj.fulfillment_line_item_id_ref1;
    }
    return data
  }

  this.buildShipper = function() {
    let shipper = {
      'name': 'Groupon Goods',
      'shipper_number': 'VE1786',
      'address': {
        'address_line_1': '1081 Aviation blvd.',
        'city': 'Hebron',
        'state_code': 'KY',
        'postal_code': '41048',
        'country_code': 'US',
      }
    };
    return shipper;
  }
  this.buildShipfrom = function(){
    let ship_from = {
      'company_name': 'Groupon Goods',
      'attention_name': 'Groupon Goods',
      'address': {
        'address_line_1': '1081 Aviation blvd.',
        'city': 'Hebron',
        'state_code': 'KY',
        'postal_code': '41048',
        'country_code': 'US',
      },
    }
    return ship_from;
  }
  this.buildShipto = function(data) {
    let ship_to = {
      'company_name': data.shipment_address_name,
      'attention_name': data.shipment_address_name,
      'address': {
        'address_line_1': data.shipment_address_street,
        'address_line_2': data.shipment_address_street_2,
        'city': data.shipment_address_city,
        'state_code': data.shipment_address_state,
        'country_code': data.shipment_address_country,
        'postal_code': data.shipment_address_postal_code,
        //'residential': (data.residentialindicator==='Y' ? true : false) NOT USED!!!
      }
    }
    return ship_to;
  }
  this.buildPackages = function(data) {
    let package = {
      'packaging_type_code': (data.service==='Expedited Mail Innovations' ? '62' : '02'),
      'unit_of_measurement_code': (data.service==='Expedited Mail Innovations' ? 'OZS' : 'LBS'),
      'weight': data.weight,
      'dimensions': {
        'length': data.length, 
        'width': data.width,
        'height': data.height,
        'unit_of_measurement_code': 'IN',
      },
    };
    return package;
  }
}


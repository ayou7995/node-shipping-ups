'use strict';

var fs = require('fs');
var XLSX = require('xlsx');
var util = require('util');
var argv = require( 'argv' );
const path = require('path');
var mkdirp = require('mkdirp');
var upsAPI = require('../lib/index');
var base64Img = require('base64-img');
var dateFormat = require('dateformat');
var PythonShell = require('python-shell');

var ups = new upsAPI({
  environment: 'sandbox', // or live
  access_key: 'BD2D6AD08E2D9BD8',
  username: 'capricemotion',
  password: 'Soundbot123',
  imperial: true
});

var args = argv.option([
  {
    name: 'date',
    short: 'd',
    type: 'string',
  },
  {
    name: 'debug',
    type: 'boolean',
  }
]).run();

var process_date = dateFormat(new Date(), "yyyymmdd");
if (args.options.hasOwnProperty('date')) {
  process_date = args.options.date;
}

const soundbot_base_dir = '/home/ayou7995/NTUEE/8th_semester/SoundBot/';
const groupon_ups_upload_dir = path.join(soundbot_base_dir, 'garbagecan/groupon_ups_upload/');
const python_script_path = path.join(soundbot_base_dir, 'create_label/src/');
const label_dir = path.join(soundbot_base_dir, 'create_label', 'labels', process_date);

mkdirp(label_dir, function (err) {
  if (err) console.error(err);
});

var workbook = XLSX.readFile(path.join(groupon_ups_upload_dir, 'Groupon_'+process_date+'.xlsx'));

function createPackingSlip(obj) {

  let create_ps_options = {
    mode: 'text',
    pythonPath: '/usr/bin/python',
    scriptPath: python_script_path,
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
      label_dir, // for storing to correct path
      obj.index_ref2 // name of label
    ]
  };
  PythonShell.run('create_packing_slip.py', create_ps_options, function (err, results) {
    if (err) throw err;
    else console.log('create packing slip final results: %j', results);
  });
}

function createShippingLabel(obj) {
  var slInfo = new ShippingLabelInfo();
  var data = slInfo.buildBasic(obj);
  data['shipper'] = slInfo.buildShipper();
  data['ship_from'] = slInfo.buildShipfrom();
  data['ship_to'] = slInfo.buildShipto(obj);
  data['packages'] = slInfo.buildPackages(obj);
  var option = slInfo.buildOption(obj);

  var p1 = new Promise (
    (resolve, reject) => {
      ups.confirm(data, option, function(err, res) {
        if(err) {
          reject(err);
        }
        if (res != null) {
          if (res.hasOwnProperty('ShipmentDigest')) {
            ups.accept(res.ShipmentDigest, function(err, res) {
              if(err){
                reject(err);
              }
              if(res.hasOwnProperty('ShipmentResults')){
                if(res['ShipmentResults'].hasOwnProperty('PackageResults')){
                  if(res['ShipmentResults']['PackageResults'].hasOwnProperty('LabelImage')){
                    if(res['ShipmentResults']['PackageResults']['LabelImage'].hasOwnProperty('GraphicImage')){
                      resolve({
                        image : res.ShipmentResults.PackageResults.LabelImage.GraphicImage, 
                        data : obj
                      });
                    }
                  }               
                }
              }
            })
          }
        }
      });
    }
  );
  p1.then(function(result) {
    let label_name = result.data.index_ref2.concat('_sl');
    console.log(label_name);
    base64Img.img('data:image/gif;base64,'.concat(result.image), 
                  label_dir, 
                  label_name, 
                  function(err, filepath){ if (err) throw err; }
    );
    return({name:label_name.concat('.gif'), data:result.data});
  }, function(reject) {
    console.log('rejection after promise');
    console.log(reject);
  }).then(function(result) {
    if (result!==null) {
      let add_ref_options = {
        mode: 'text',
        pythonPath: '/usr/bin/python',
        scriptPath: python_script_path,
        args: [
          path.join(label_dir, result.name), 
          obj.fulfillment_line_item_id_ref1, 
          'SoundBotGroupon',
          obj.MasterSalesOrderNum_ref5,
          obj.SKU_QTY,
          obj.packing_package_type
        ]
      };
      PythonShell.run('add_reference.py', add_ref_options, function (err, results) {
        if (err) throw err;
        else console.log('shipping label final results: %j', results);
      });
    }
  })
};

function ShippingLabelInfo() {

  this.buildBasic = function(obj) {
    let data = {
      pickup_type : 'daily_pickup',
      saturday_delivery : true,
      uspsendorsement : '1',
      label_type : 'GIF',
    }
    if (obj.service == 'SurePost 1 lb or Greater') {
      data['service_code'] = '93';
      //option = {};
    } else if (obj.service == 'Ground') {
      data['service_code'] = '03';
      //option = {};
    } else if (obj.service == 'Expedited Mail Innovations') {
      data['service_code'] = 'M4';
      data['packageid'] = obj.fulfillment_line_item_id_ref1;
      data['cost_center'] = 'SOUNDBOTGROUPON';
      data['subclassification'] = 'IR';
      //option = {use_ounces: true};
    }
    return data
  }
  this.buildOption = function(obj) {
    let option = {};
    if (obj.service == 'Expedited Mail Innovations') {
      option = {use_ounces: true};
    }
    return option;
  }

  this.buildShipper = function() {
    var shipper_info = {
      name: 'Groupon Goods',
      shipper_number: 'VE1786', // optional, but recommended for accurate rating
      address: {
        address_line_1: '1081 Aviation blvd.',
        city: 'Hebron',
        state_code: 'KY',
        postal_code: '41048',
        country_code: 'US',
      }
    };
    return shipper_info;
  }
  this.buildShipfrom = function(){
    var ship_from = { // optional, use if different from shipper address
      company_name: 'Groupon Goods', // or person's name
      attention_name: 'Groupon Goods',
      address: {
        address_line_1: '1081 Aviation blvd.',
        city: 'Hebron',
        state_code: 'KY',
        postal_code: '41048',
        country_code: 'US',
      },
    }
    return ship_from;
  }
  this.buildShipto = function(data) {
    var ship_to = {
      company_name: data.shipment_address_name, // or person's name
      attention_name: data.shipment_address_name, // optional
      address: {
        address_line_1: data.shipment_address_street, // optional
        address_line_2: data.shipment_address_street_2, // optional
        city: data.shipment_address_city, // optional
        state_code: data.shipment_address_state, // optional, required for negotiated rates
        country_code: data.shipment_address_country,
        postal_code: data.shipment_address_postal_code,
        residential: (data.residentialindicator==='Y' ? true : false) // optional, can be useful for accurate rating
      }
    }
    return ship_to;
  }
  this.buildPackages = function(data) {
    var packages = [{
      packaging_type: (data.service=='Expedited Mail Innovations' ? '62' : '02'),
      weight: data.weight, // '15',
      description: data.Message, // optional
      dimensions: { // l + 2 * (w+h) < 130IN 
        length: data.length, // '9',
        width: data.width, // '7.5',
        height: data.height, //'2.5',
      },
    }];
    return packages;
  }
}

function readXlsx(){
  let upload_data_worksheet = [];
  if ( workbook.SheetNames.indexOf('Upload_Data') >= 0 ) {
    upload_data_worksheet = workbook.Sheets['Upload_Data'];
    upload_data_worksheet = XLSX.utils.sheet_to_json(upload_data_worksheet);
  }
  return upload_data_worksheet;
}

function createLabel(){

  var xlsxdata = readXlsx();
  var row_count = 0;
  labelLoop();
  function labelLoop(){
    let obj = xlsxdata[row_count];
    var option = {};
    console.log(row_count);
    console.log(obj.index_ref2);
    console.log(obj.service);
    
    if (obj.service !== 'Error') {
      createShippingLabel(obj);
      createPackingSlip(obj);
    } 

    if(++row_count == xlsxdata.length){
      return;
    }
    setTimeout(labelLoop, 1000);
  }

}
createLabel();
//function printShippingLabel() {

  //function buildShipper() {
    //var shipper_info = {
      //name: 'Groupon Goods',
      //shipper_number: 'VE1786', // optional, but recommended for accurate rating
      //address: {
        //address_line_1: '1081 Aviation blvd.',
        //city: 'Hebron',
        //state_code: 'KY',
        //postal_code: '41048',
        //country_code: 'US',
      //}
    //};
    //return shipper_info;
  //}
  //function buildShipfrom(){
    //var ship_from = { // optional, use if different from shipper address
      //company_name: 'Groupon Goods', // or person's name
      //attention_name: 'Groupon Goods',
      //address: {
        //address_line_1: '1081 Aviation blvd.',
        //city: 'Hebron',
        //state_code: 'KY',
        //postal_code: '41048',
        //country_code: 'US',
      //},
    //}
    //return ship_from;
  //}
  //function buildShipto(data){
    //var ship_to = {
      //company_name: data.shipment_address_name, // or person's name
      //attention_name: data.shipment_address_name, // optional
      //address: {
        //address_line_1: data.shipment_address_street, // optional
        //address_line_2: data.shipment_address_street_2, // optional
        //city: data.shipment_address_city, // optional
        //state_code: data.shipment_address_state, // optional, required for negotiated rates
        //country_code: data.shipment_address_country,
        //postal_code: data.shipment_address_postal_code,
        //residential: (data.residentialindicator==='Y' ? true : false) // optional, can be useful for accurate rating
      //}
    //}
    //return ship_to;
  //}
  //function buildPackages(data){
    //var packages = [{
      //packaging_type: (data.service=='Expedited Mail Innovations' ? '62' : '02'),
      //weight: data.weight, // '15',
      //description: data.Message, // optional
      //dimensions: { // l + 2 * (w+h) < 130IN 
        //length: data.length, // '9',
        //width: data.width, // '7.5',
        //height: data.height, //'2.5',
      //},
    //}];
    //return packages;
  //}
  //function readXlsx(){
    //var upload_data_worksheet = [];
    //if (  workbook.SheetNames.indexOf('Upload_Data') >= 0  ) {
      //upload_data_worksheet = workbook.Sheets['Upload_Data'];
      //upload_data_worksheet = XLSX.utils.sheet_to_json(upload_data_worksheet);
    //}
    //return upload_data_worksheet;
  //}

  //var xlsxdata = readXlsx();
  //var count = 0;
  //labelLoop();
  //function labelLoop(){
    //let obj = xlsxdata[count];
    //var option = {};
    //console.log(count);
    //console.log(obj.index_ref2);
    
    //buildLabel(obj);
    //if(++count == xlsxdata.length){
      //return;
    //}
    //setTimeout(labelLoop, 1000);
    ////xlsxdata.forEach(function(obj) { ///////////////////////////
    //function buildLabel(obj) {
      //console.log(obj.service);
      //if (obj.service==='Error') return;
      ////if (obj.service==='Expedited Mail Innovations') return;
      ////if (obj.service==='SurePost 1 lb or Greater') return;
      //var data = {
        //pickup_type : 'daily_pickup',
        //saturday_delivery : true,
        //uspsendorsement : '1',
        //label_type : 'GIF',
      //}

      //if (obj.service == 'SurePost 1 lb or Greater') {
        //data['service_code'] = '93';
        //option = {};
      //} else if (obj.service == 'Ground') {
        //data['service_code'] = '03';
        //option = {};
      //} else if (obj.service == 'Expedited Mail Innovations') {
        //data['service_code'] = 'M4';
        //data['packageid'] = obj.fulfillment_line_item_id_ref1;
        //data['cost_center'] = 'SOUNDBOTGROUPON';
        //data['subclassification'] = 'IR';
        //option = {use_ounces: true};
      //}
      //data['shipper'] = buildShipper();
      //data['ship_to'] = buildShipto(obj);
      //data['ship_from'] = buildShipfrom();
      //data['packages'] = buildPackages(obj);

      //var graphimages = [];
      //var p1 = new Promise (
        //(resolve, reject) => {
          //ups.confirm(data, option, function(err, res) {
            //if(err) {
              ////console.log(obj.service);
              ////console.log(util.inspect(data, {depth: null}));
              ////console.log(option);
              //console.log(err);
            //}
            ////console.log(res);
            //var respond = util.inspect(res, {depth: null});
            ////console.log(res);
            //if (res != null) {
              //if (res.hasOwnProperty('ShipmentDigest')) {
                //ups.accept(res.ShipmentDigest, function(err, res) {
                  //if(err){
                    //console.log(err);
                    //reject(err);
                  //}
                  ////console.log(util.inspect(res, {depth:null}));
                  //if(res.hasOwnProperty('ShipmentResults')){
                    //if(res.ShipmentResults.hasOwnProperty('PackageResults')){
                      //if(res['ShipmentResults']['PackageResults'].hasOwnProperty('LabelImage')){
                        //if(res['ShipmentResults']['PackageResults']['LabelImage'].hasOwnProperty('GraphicImage')){
                          //resolve({
                            //image : res.ShipmentResults.PackageResults.LabelImage.GraphicImage, 
                            //data : obj
                          //});
                        //}
                      //}               
                    //}
                  //}
                //})
              //}
            //}
          //});
        //}
      //);
      //p1.then(function(result){
        //var label_name = 'shipping_label_'.concat(result.data.index_ref2);
        //base64Img.img('data:image/gif;base64,'.concat(result.image), 
                      //'../labels/20170908/', 
                      //label_name, 
                      //function(err, filepath){console.log(err);}
        //);
        //return({name:label_name.concat('.gif'), data:result.data});
      //}).then(function(result){
        //console.log('label name', result.name);
        //var options = {
          //mode: 'text',
          //pythonPath: '/usr/bin/python',
          ////pythonOptions: ['-u'],
          //scriptPath: '/home/ayou7995/NTUEE/8th_semester/SoundBot/create_label/src',
          //args: [
            //'../labels/20170908/'.concat(result.name), 
            //obj.fulfillment_line_item_id_ref1, 
            //'SoundBotGroupon',
            //obj.MasterSalesOrderNum_ref5,
            //obj.SKU_QTY,
            //obj.packing_package_type
          //]
        //};
        //PythonShell.run('add_reference.py', options, function (err, results) {
          //if (err) throw err;
          ////results is an array consisting of messages collected during execution
          //console.log('results: %j', results);
        //});
      //})
    //};
  //}
//}
//printShippingLabel()

//function print_packing_list(){
  //packlist_template

//}

////ups.address_validation({
////name: 'Baby Griff',
////address_line_1: '2903 Wood Poppy Dr',
////city: 'Florissant',
////state_code: 'MO',
////postal_code: '63031-1029',
////country_code: 'US'
////}, function(err, res) {
////if(err) {
//////console.log(err);
////}
//////console.log(util.inspect(res, {depth: null}));
////});


var fs = require('fs');
var util = require('util');
var fetch = require('node-fetch');
var _ = require('lodash');

var UpsError = require('./upserror.js').UpsError;

/**********  general purpose **********/
function buildUpsSecurity(){
  return {
    UsernameToken: {
      Username: 'capricemotion',
      Password: 'Soundbot123',
    },
    ServiceAccessToken: {
      AccessLicenseNumber: 'BD2D6AD08E2D9BD8',
    },
  }
}

function buildFetchOptions (request) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body:JSON.stringify(request),
  }
}

/********** address validation **********/
function validateAddress (data) {
  let url = 'https://onlinetools.ups.com/rest/XAV';
  let request = buildAddressValidationRequest(data);
  let options = buildFetchOptions(request);
  return fetch(url, options);
}

function buildAddressValidationRequest(data){
  let addressValidationRequest = {};
  addressValidationRequest.UPSSecurity = buildUpsSecurity();
  addressValidationRequest.XAVRequest = buildXAVRequest(data);
  return addressValidationRequest;
}

function buildXAVRequest(data) {
  return {
    Request:{
      RequestOption: data.request_option || '3',
    },
    AddressKeyFormat: {
      ConsigneeName: data.name || '', 
      AddressLine: [
        data.address_line_1 || '',
        data.address_line_2 || '',
        data.address_line_3 || '', 
      ],
      PoliticalDivision1: data.state || '',
      PoliticalDivision2: data.city || '',
      PostcodePrimaryLow: data.postal_code || '',
      CountryCode: data.country || '',   
    }
  }
}

function handleAddressValidationResponse(index_ref2, json, DEBUG = false) {
  if( DEBUG ) {
    console.log('--handleAddressValidationResponse--');
    console.log(util.inspect(json, {depth: null}));
  }
  let error = _.get(json,['XAVResponse','Error'], null);
  if (error) {
    throw new UpsError(index_ref2, 'Address Validation Failure', error.ErrorCode, error.ErrorDescription);
  }
  let candidate = _.get(json,['XAVResponse','Candidate'], null);
  if (candidate) {
    return candidate.AddressKeyFormat;    
  } else {
    throw new UpsError(index_ref2, 'Address Validation Failure', '100', 'No address key candidate, missing or invalid address!!');
  }
}

/**********  shipment confirm  **********/
function confirmShipment (data, inProduction = false) {
  let url;
  if (inProduction) {
    url = 'https://onlinetools.ups.com/rest/Ship';
  } else {
    url = 'https://wwwcie.ups.com/rest/Ship';
  }
  let request = buildPublishedRateShipmentRequest(data);
  let options = buildFetchOptions(request);
  return fetch(url, options);
}

function handleShipmentResponse(index_ref2, json, DEBUG = false) {
  if( DEBUG ) {
    console.log('--handleShipmentResponse--');
    console.log(util.inspect(json, {depth: null}));
  }
  let error = _.get(json,['Fault','detail','Errors'], null);
  if (error) {
    error_code = _.get(error, ['ErrorDetail', 'PrimaryErrorCode', 'Code'], null);
    error_description = _.get(error, ['ErrorDetail', 'PrimaryErrorCode', 'Description'], null);
    throw new UpsError(index_ref2, 'Shipment Request Failure', error_code , error_description);
  }
  let package_results = _.get(json, ['ShipmentResponse','ShipmentResults','PackageResults'], null);
  let tracking_number = _.get(package_results, 'TrackingNumber', null);
  let uspspicnumber = _.get(package_results, 'USPSPICNumber', null);
  let graphic_image = _.get(package_results, ['ShippingLabel', 'GraphicImage'], null);
  if ( tracking_number === null ) {
    throw new UpsError(index_ref2 + 'Shipment Request Failure', '200', 'Fail to get tracking number');
  } else {
    return {
      'tracking_number': tracking_number,
      'uspspicnumber': uspspicnumber,
      'graphic_image': graphic_image,
    }
  }
}

function buildPublishedRateShipmentRequest(data) {
  let publishedRateShipmentRequest = {};
  publishedRateShipmentRequest.UPSSecurity = buildUpsSecurity();
  publishedRateShipmentRequest.ShipmentRequest = buildShipmentRequest(data);
  return publishedRateShipmentRequest;
}

function buildShipmentRequest(data) {
  let shipmentRequest = {
    'Request': {
      'RequestOption': 'validate',
    },
    'Shipment': buildShipment(data),
    'LabelSpecification': {
      'LabelPrintMethod': {
        'Code': 'GIF'
      },
      'LabelImageFormat': {
        'Code': 'PNG'
      }
    },
  };
  return shipmentRequest;
}

function buildAddress(data) {
  let address = {
    'AddressLine': [
      data.address_line_1 || '',
      data.address_line_2 || '',
      data.address_line_3 || ''
    ],
    'City': data.city || '',
    'StateProvinceCode': data.state_code || '',
    'PostalCode': data.postal_code || '',
    'CountryCode': data.country_code || '',
  };
  return address;
}

function buildShipment(data) {

  let shipment = {
    'Shipper': {
      'Name': data.shipper.name || '',
      'ShipperNumber': data.shipper.shipper_number,
      'Address': buildAddress(data.shipper.address),
    },
    'ShipTo': {
      'Name': data.ship_to.company_name || '',
      'AttentionName': data.ship_to.attention_name || ( data.ship_to.company_name || '' ),
      'Address': buildAddress(data.ship_to.address),
    },
    'ShipFrom': {
      'Name': data.ship_from.company_name || '',
      'AttentionName': data.ship_from.attention_name || ( data.ship_from.company_name || '' ),
      'Address': buildAddress(data.ship_from.address),
    },
    'Service': {
      'Code': data.service_code,
    },
    'Package': {
      'Packaging': {
        'Code': data.package.packaging_type_code,
      },
      'PackageWeight': {
        'Weight': data.package.weight,
        'UnitOfMeasurement': {
          'Code': data.package.unit_of_measurement_code, 
        },
        'Dimensions': {
          'Length': data.package.dimensions.length,
          'Width': data.package.dimensions.width,
          'Height': data.package.dimensions.height,
          'UnitOfMeasurement': {
            'Code': data.package.dimensions.unit_of_measurement_code,
          }
        }
      }
    },
    'PaymentInformation': {
      'ShipmentCharge': {
        'Type': '01',
        'BillShipper': {
          'AccountNumber': data.shipper.shipper_number,
        }
      }
    }
  }
  if(data.service_code=='M4'){
    shipment['USPSEndorsement'] = data.uspsendorsement || '1';
    shipment['SubClassification'] = data.subclassification || 'IR';
    shipment['CostCenter'] = data.cost_center || 'SOUNDBOTGROUPON';
    shipment['PackageID'] = data.packageid;
  }
  if(data.saturday_delivery) {
    if(!shipment.ShipmentServiceOptions || !(shipment.ShipmentServiceOptions instanceof Array)) {
      shipment.ShipmentServiceOptions = [];
    }
    shipment.ShipmentServiceOptions['SaturdayDelivery'] = true;
  }
  return shipment;
}

module.exports.validateAddress = validateAddress;
module.exports.handleAddressValidationResponse = handleAddressValidationResponse;
module.exports.confirmShipment = confirmShipment;
module.exports.handleShipmentResponse = handleShipmentResponse;

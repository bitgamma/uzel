var express = require('express');
var tlv = require('tlv');
var app;
var appMgr;
var devMgr;

exports.createAppliance = function(applianceManager) {
  if (!app) {
    app = express();
    appMgr = applianceManager;
    devMgr = appMgr.devMgr;
    app.get('/', index);
  }
  
  return app;
}

function index(req, res, done) {
  //now show all thermometers...
  var devices = devMgr.getDevices(devMgr.DeviceType.TEMPERATURE_SENSOR);
  devices.forEach(function(device) {
    devMgr.getData(device, function(device, data) {
      var tlvResp = tlv.parse(data);
      res.send(tlvResp);
    });
  });
}
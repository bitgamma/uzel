var express = require('express');
var app;
var appMgr;
var devMgr;

var units = ["Kelvin", "Celsius", "Fahrenhet"];

exports.createAppliance = function(applianceManager) {
  if (!app) {
    app = express();
    appMgr = applianceManager;
    devMgr = appMgr.deviceManager;
    app.get('/', index);
  }
  
  return app;
}

function index(req, res, next) {
  //now show all thermometers...
  var devices = devMgr.getDevices(devMgr.DeviceType.TEMPERATURE_SENSOR);
  var processed = 0;
  var results = "";
    
  if (devices.length == 0) {
    res.send("No devices");
  }
  
  devices.forEach(function(device) {
    devMgr.getData(device, function(command, responseTLV) {
      
      var thermoData = responseTLV.getFirstChild(0xA1);
    
      var temperature = thermoData.getFirstChild(0x82).value.readInt32BE(0) / thermoData.getFirstChild(0x81).value.readUInt16BE(0);
      var unit = thermoData.getFirstChild(0x80).value.readUInt8(0);
      
      results = results + temperature + " " + units[unit] + "<br>";
      processed++;
      
      if (processed == devices.length) {
        res.send(results);
      }
    });
  });
}
var express = require('express');
var app;
var appMgr;
var devMgr;

var units = ["Kelvin", "Celsius", "Fahrenhet"];

exports.createAppliance = function(applianceManager) {
  if (!app) {
    app = express();
    app.use(express.static(__dirname + '/public'));
    app.set('views', __dirname + '/views');
    
    appMgr = applianceManager;
    devMgr = appMgr.deviceManager;
    app.get('/', index);
  }
  
  return app;
}

function index(req, res, next) {
  //now show all thermometers...
  var devices = devMgr.getDevicesByType(devMgr.DeviceType.TEMPERATURE_SENSOR);
  var processed = 0;
  var results = "";
    
  if (devices.length == 0) {
    res.send("No devices");
  }
  
  devices.forEach(function(device) {
    devMgr.getData(device, function(command, responseTLV) {
      
      var thermoData = responseTLV.getFirstChild(0xA1);
    
      var temperature = thermoData.getFirstChild(0x82).getIntValue() / thermoData.getFirstChild(0x81).getUIntValue();
      var unit = thermoData.getFirstChild(0x80).getUIntValue();
      
      results = results + temperature + " " + units[unit] + "<br>";
      processed++;
      
      if (processed == devices.length) {
        res.send(results);
      }
    });
  });
}
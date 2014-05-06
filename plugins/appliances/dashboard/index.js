require('es6-shim');

var path = require('path');
var util = require('util');
var express = require('express');
var Datastore = require('nedb');

var app;
var appMgr;
var devMgr;

var monitoredDevices;
var supportedTypes;

exports.createAppliance = function(applianceManager) {
  if (!app) {
    appMgr = applianceManager;
    devMgr = appMgr.deviceManager;
    
    monitoredDevices = new Datastore({ filename: path.join(appMgr.configuration.persistencyPath, 'dashboard.nedb'), autoload: true });
    
    devMgr.on('deviceUnpaired', function(device) { removeDevice(device.id) });
    
    app = express();
    app.set('views', __dirname + '/views');
    app.use(express.static(__dirname + '/public'));
    
    app.get('/', index);
    app.get('/getDevicesByType', getDevicesByType);
    app.get('/getSupportedTypes', getSupportedTypes);
    appMgr.io.of('/dashboard').on('connection', handleDashboardSocketConnection);
    
    //TODO: fill this array through plugins
    supportedTypes = [
      { 'name': 'All', 'value': [ devMgr.DeviceType.TEMPERATURE_SENSOR ] },
      { 'name': 'Temperature Sensor', 'value': [ devMgr.DeviceType.TEMPERATURE_SENSOR ] },
    ];
  }
  
  return app;
}

function index(req, res) {
  res.render('index.jade', { });
}

function getDevicesByType(req, res) {
  var types = req.query.types;
  
  if (util.isArray(types)) {
    types = types.map(function(a) { return parseInt(a); });
  } else {
    types = [ parseInt(types) ];
  }
  
  devMgr.getDevicesByType(types, function(devices) {
    var foundDevices;
    var processed = 0;
    
    for(var i = 0, len = devices.length; i < len; i++) {
      monitoredDevices.findOne({ id: devices[i].id }, function(dev) {
        if (!dev) {
          foundDevices.push(deviceDescriptor(devices[i]));
        }
        
        processed++;
        
        if (processed == len) {
          res.json(foundDevices);
        }
      });
    }    
  });  
}

function getSupportedTypes(req, res) {
  res.json(supportedTypes);
}

function handleDashboardSocketConnection(socket) {
  socket.emit('init', monitoredDevices.map(deviceDescriptor));
  socket.on('addMonitoredDevice', addMonitoredDevice);
  socket.on('removeDevice', removeDevice);
  socket.on('updateDevice', updateDevice);
}

function addMonitoredDevice(deviceID) {
  devMgr.getDeviceByID(deviceID, function(device) {
    monitoredDevices.insert(deviceDescriptor(device), function(insertErr, insertedDevice) {
      getUpdatedDeviceData(device);
      appMgr.io.of('/dashboard').emit('deviceAdded', insertedDevice);   
    });
  });
}

function removeDevice(deviceID) {
  monitoredDevices.remove({ id: deviceID }, {}, function (err, numRemoved) {
    if (numRemoved > 0) {
      appMgr.io.of('/dashboard').emit('deviceRemoved', deviceID);
    }
  });
}

function updateDevice(deviceID) {
  devMgr.getDeviceByID(deviceID, function(device) {
    getUpdatedDeviceData(device);    
  });
}

function getUpdatedDeviceData(device) {
  //TODO: here registered plugins should be able to query data depending on types
  if (device.deviceInfo.type == devMgr.DeviceType.TEMPERATURE_SENSOR) {
    devMgr.getData(device, handleTemperatureDataReceived.bind(null, processFormattedResponse));
  }
}

function processFormattedResponse(command, formattedResponse) {
  appMgr.io.of('/dashboard').emit('deviceUpdated', command.device.id, formattedResponse);  
}

function handleTemperatureDataReceived(cb, command, response) {
  var units = ['K', 'C', 'F'];
  var thermoData = response.getFirstChild(0xA1);

  var temperature = thermoData.getFirstChild(0x82).getIntValue() / thermoData.getFirstChild(0x81).getUIntValue();
  var unit = thermoData.getFirstChild(0x80).getUIntValue();
  cb(command, temperature + ' ' + units[unit]);
}

function deviceDescriptor(device) {
  return { 'id': device.id, 'name': device.deviceInfo.name, 'value': '...' };
}

require('es6-shim');

var express = require('express');
var app;
var appMgr;
var devMgr;

var monitoredDevices = [];
var supportedTypes;

exports.createAppliance = function(applianceManager) {
  if (!app) {
    appMgr = applianceManager;
    devMgr = appMgr.deviceManager;
    
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
  res.json(devMgr.getDevicesByType(req.query.types).filter(function(element) { 
    return monitoredDevices.indexOf(element) == -1;
  }).map(deviceDescriptor));
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
  var device = devMgr.getDeviceByID(deviceID);
  
  if (device) {
    monitoredDevices.push(device);
    getUpdatedDeviceData(device);
    appMgr.io.of('/dashboard').emit('deviceAdded', deviceDescriptor(device));
  }
}

function removeDevice(deviceID) {
  monitoredDevices = monitoredDevices.filter(function(dev) { 
    return dev.id != deviceID;
  });
  
  appMgr.io.of('/dashboard').emit('deviceRemoved', deviceID);  
}

function updateDevice(deviceID) {
  var device = devMgr.getDeviceByID(deviceID);
  
  if (device) {
    getUpdatedDeviceData(device);
  }
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

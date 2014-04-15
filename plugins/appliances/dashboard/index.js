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
      { 'name': 'All', 'value': [ devMgr.DeviceType.TEMPERATURE_SENSOR, devMgr.DeviceType.MOISTURE_SENSOR ] },
      { 'name': 'Temperature Sensor', 'value': [ devMgr.DeviceType.TEMPERATURE_SENSOR ] },
      { 'name': 'Moisture Sensor', 'value': [ devMgr.DeviceType.MOISTURE_SENSOR ] },
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
  socket.emit('init', monitoredDevices);
  socket.on('addMonitoredDevice', addMonitoredDevice.bind(null, socket));
}

function addMonitoredDevice(socket, deviceID) {
  var device = devMgr.getDeviceByFullID(deviceID);
  
  if (device) {
    monitoredDevices.push(device);
    appMgr.io.of('/dashboard').emit('addedDevice', device);
  }
}

function deviceDescriptor(device) {
  return { 'id': device.getFullID(), 'name': device.deviceInfo.name };
}

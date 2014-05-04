var express = require('express');
var PluginLoader = require('plugin-loader').PluginLoader;
var socketio = require('socket.io');
var http = require('http');
var printf = require('printf');

var deviceTypes = {
  "1": "Temperature Sensor"
};

exports.ApplianceManager = function(config, deviceManager) {
  Object.defineProperty(this, 'deviceManager', { value: deviceManager });
  this._applianceLoader = new PluginLoader(config.applianceDirectories);
  this._app = express();
}

exports.ApplianceManager.prototype.start = function() {
  this._app.use(express.static(__dirname + '/../public'));
  this._app.set('views', __dirname + '/../views');
  
  // define default routes
  this._app.get('/', handleIndex.bind(this));
  this._app.get('/dm', handleDeviceManager.bind(this));
  
  this._applianceLoader.on('pluginLoaded', initializeAppliance.bind(this));
  this._applianceLoader.on('pluginUnloaded', destroyAppliance.bind(this));
  this._applianceLoader.startMonitoring();
  
  this._server = http.createServer(this._app);
  this.io = socketio.listen(this._server);
  
  if (process.env.NODE_ENV == 'production') {
    this.io.enable('browser client minification');
    this.io.enable('browser client etag');
    this.io.enable('browser client gzip');
    this.io.set('log level', 1);  
  }
  
  this.deviceManager.on('deviceDiscovered', handleDeviceDiscovered.bind(this));
  this.io.of('/devices').on('connection', handleDevicesSocketConnection.bind(this));
  
  this._server.listen(8000);
}

function initializeAppliance(applianceName, appliance) {
  console.log('Loading appliance: ' + applianceName);
  var instance = appliance.createAppliance(this);
  this._app.use('/' + applianceName, instance);
}

function destroyAppliance(applianceName, appliance) {
  console.log('Unloading appliance: ' + applianceName);
  // handle deactivating applications
}

function idToLabel(id) {
  return id.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
}

function handleIndex(req, res) {
  var moduleDescriptors = [];
  
  for (var moduleName in this._applianceLoader.loadedModules) {
    moduleDescriptors.push({ url: '/' + moduleName, icon: '/' + moduleName + '/icon.svg', label: idToLabel(moduleName)});
  }

  moduleDescriptors.push({ url: '/dm', icon: '/img/device_manager.svg', label: 'Device Manager'});
  moduleDescriptors.push({ url: '/settings', icon: '/img/settings.svg', label: 'Settings'});
      
  res.render('index.jade', { appliances: moduleDescriptors });
}

function handleDeviceManager(req, res) {
  res.render('device_manager.jade', {});  
}

function handleDevicesSocketConnection(socket) {
  socket.emit('init', { 
    'pairedDevices': this.deviceManager.getPairedDevices().map(deviceDescriptor),
    'unpairedDevices': this.deviceManager.getUnpairedDevices().map(deviceDescriptor)
  });
  
  socket.on('discoverDevices', function() {
    this.deviceManager.discoverDevices();
  }.bind(this));
  
  socket.on('pairDevice', function(deviceDescriptor) {
    var device = this.deviceManager.getUnpairedDeviceByID(deviceDescriptor.id);
    //TODO: handle pairing data
    this.deviceManager.pair(device, null, handleDevicePaired.bind(this, socket));
  }.bind(this));
  
  socket.on('unpairDevice', function(deviceDescriptor) {
    var device = this.deviceManager.getDeviceByID(deviceDescriptor.id);
    this.deviceManager.unpair(device, handleDeviceUnpaired.bind(this, socket));
  }.bind(this));
}

function handleDeviceDiscovered(device) {
  var desc = deviceDescriptor(device);
  this.io.of('/devices').emit('deviceDiscovered', desc);
}

function handleDevicePaired(socket, device, err) {  
  if(!err) {
    var desc = deviceDescriptor(device);
    this.io.of('/devices').emit('devicePaired', desc);    
  }
}

function handleDeviceUnpaired(socket, device, err) {
  if(!err) {
    var desc = deviceDescriptor(device);
    this.io.of('/devices').emit('deviceUnpaired', desc);    
  }
}

function deviceDescriptor(device) {
  return {
    'id': device.id,
    'name': (device.deviceInfo.name || 'Unknown name'),
    'manufacturer': (device.deviceInfo.manufacturer || 'Unknown manufacturer'),
    'type': deviceTypes[device.deviceInfo.type],
    'icon': '/img/devices/' + printf('%04x', device.deviceInfo.type) + '.svg'
  }
}


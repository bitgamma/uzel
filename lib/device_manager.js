require('es6-shim');

var assert = require('assert');
var events = require('events');
var util = require('util');
var tlv = require('TLV');
var TLV = tlv.TLV;
var PluginLoader = require('plugin-loader').PluginLoader;

var DeviceType = {
  TEMPERATURE_SENSOR: 0x0001,
  MOISTURE_SENSOR: 0x0002,
  VELOCITY_SENSOR: 0x0003,
};

var CommandType = {
  GET_DEVICE_INFO: 0xA0,
  CONFIGURE: 0xA1,
  GET_DATA: 0xA2,
  PERFORM: 0xA3,
  SUBSCRIBE: 0xA4,
  UNSUBSCRIBE: 0xA5,
};

exports.Device = function(id, connector, protocolInfo, parentDevice, subdeviceID) {
  this.id = id;
  this.connector = connector;
  this.protocolInfo = protocolInfo;
  this.parent = parentDevice;
  this.subdeviceID = subdeviceID;
  this.deviceInfo = null;
  this.type = null;
}

exports.Device.prototype.getPhysicalID = function() {
  return this.connector + "|" + this.id;
}

exports.Device.prototype.getFullID = function() {
  return this.parent ? (this.getPhysicalID() + "#" + this.subdeviceID) : this.getPhysicalID();
}

exports.DeviceCommand = function(device, type, parameters, callback) {
  this.device = device;
  this.type = type;
  this.parameters = parameters;
  this.callback = callback;
}

exports.DeviceManager = function(config) {
  this._connectorLoader = new PluginLoader(config.connectorDirectories);
  this._config = config;
  this._pairedDevices = [];
  this._unpairedDevices = [];
  this._subscriptions = new Map();
}

util.inherits(exports.DeviceManager, events.EventEmitter);

exports.DeviceType = DeviceType;
exports.CommandType = CommandType;
exports.DeviceManager.prototype.DeviceType = DeviceType;
exports.DeviceManager.prototype.CommandType = CommandType;

exports.DeviceManager.prototype.start = function(done) {
  // start db connection
  this._connectorLoader.on('pluginLoaded', initializeConnector.bind(this))
  this._connectorLoader.on('pluginUnloaded', destroyConnector.bind(this))
  this._connectorLoader.startMonitoring();
  done();
}

exports.DeviceManager.prototype.discoverDevices = function(cb) {
  for (var connectorName in this._connectorLoader.loadedModules) {
    this._connectorLoader.loadedModules[connectorName].discoverDevices(handleDiscoveredDevice.bind(this, connectorName, cb));
  }
}

exports.DeviceManager.prototype.getDevicesByType = function(types) {
  if (types === undefined) {
    return this._pairedDevices;
  } else if (!util.isArray(types)) {
    types = [ types ];
  }
  
  // substitute with db code
  var foundDevices = [];
  types.forEach(function(type) {
    this._pairedDevices.forEach(function(device) {
     if (device.type == type) {
       foundDevices.push(device);
     }
    });
  }.bind(this));
  
  return foundDevices;
}

exports.DeviceManager.prototype.getDeviceByFullID = function(fullID) {  
  return findDeviceByFullID(this._pairedDevices);
}

exports.DeviceManager.prototype.getDeviceInfo = function(device, cb) {
  this.sendCommands([ this.createGetDeviceInfoCommand(device, handleGetInfoResponse.bind(this, cb)) ]);
}

exports.DeviceManager.prototype.createGetDeviceInfoCommand = function(device, cb) {
  return new exports.DeviceCommand(device, CommandType.GET_DEVICE_INFO, [], cb);
}

exports.DeviceManager.prototype.configureDevice = function(device, options, cb) {  
  this.sendCommands([ this.createConfigureCommand(device, options, cb) ]);
}

exports.DeviceManager.prototype.createConfigureCommand = function(device, options, cb) {  
  var params = [ new TLV(0xA0, options) ];
  
  return new exports.DeviceCommand(device, CommandType.CONFIGURE, params, cb);
}

exports.DeviceManager.prototype.getData = function(device, options, cb) {  
  this.sendCommands([ this.createGetDataCommand(device, options, cb) ]);
}

exports.DeviceManager.prototype.createGetDataCommand = function(device, options, cb) {
  if (options instanceof Function) {
    cb = options;
    options = [];
  }
  
  var params = [];
  
  if (options.length > 0) {
    params.push(new TLV(0xA0, options));
  }
  
  return new exports.DeviceCommand(device, CommandType.GET_DATA, params, cb);
}

exports.DeviceManager.prototype.perform = function(device, action, options, cb) {  
  this.sendCommands([ this.createPerformCommand(device, action, options, cb) ]);
}

exports.DeviceManager.prototype.createPerformCommand = function(device, action, options, cb) {
  if (options instanceof Function) {
    cb = options;
    options = [];
  }
  
  var params = [ new TLV(0x81, new Buffer([action])) ];

  if (options.length > 0) {
    params.push(new TLV(0xA0, options));
  }
  
  return new exports.DeviceCommand(device, CommandType.PERFORM, params, cb);
}

exports.DeviceManager.prototype.subscribe = function(device, notificationIDs, cb) {
  var subscribedNotificationsForDevice = this._subscriptions.get(device);
  var stillUnsubscribedNotifications = [];
  
  if (!subscribedNotificationsForDevice) {
    subscribedNotificationsForDevice = new Map();
    this._subscriptions.set(device, subscribedNotificationsForDevice);
  }
  
  for (var i = 0, len = notificationsIDs.length; i < len; i++) {
    var subscribers = subscribedNotificationsForDevice.get(notificationsIDs[i]);
    
    if (!subscribers) {
      subscribers = [];
      subscribedNotificationsForDevice.set(notificationsIDs[i], subscribers);
    }
    
    if (subscribers.length == 0) {
      stillUnsubscribedNotifications.push(notificationsIDs[i]);      
    }
    
    if (subscribers.indexOf(cb) == -1) {
      subscribers.push(cb);      
    }
  }
  
  if (stillUnsubscribedNotifications.length > 0) {
    this.sendCommands([ createSubscribeCommand(device, stillUnsubscribedNotifications, handleSubscribeResponse.bind(this)) ])
  }
}

exports.DeviceManager.prototype.createSubscribeCommand = function(device, notificationIDs, cb) {
  var params = [ new TLV(0x81, tlv.encodeTags(notificationIDs)) ];
  return new exports.DeviceCommand(device, CommandType.SUBSCRIBE, params, cb);
}

exports.DeviceManager.prototype.unsubscribe = function(device, notificationIDs, cb) {
  var subscribedNotificationsForDevice = this._subscriptions.get(device);
  var notificationsToUnsubscribe = [];
  
  if (!subscribedNotificationsForDevice) {
    return;
  }
  
  for (var i = 0, len = notificationsIDs.length; i < len; i++) {
    var subscribers = subscribedNotificationsForDevice.get(notificationsIDs[i]);
    
    if (subscribers) {
      var idx = subscribers.indexOf(cb);
    
      if (idx != -1) {
        subscribers.splice(idx, 1); 
      }
      
      if (subscribers.length == 0) {
        notificationsToUnsubscribe.push(notificationsIDs[i]);
      }   
    }
  }
  
  if (notificationsToUnsubscribe.length > 0) {
    this.sendCommands([ createUnsubscribeCommand(device, notificationsToUnsubscribe, handleUnsubscribeResponse.bind(this)) ])
  }
}

exports.DeviceManager.prototype.createUnsubscribeCommand = function(device, notificationIDs, cb) {
  var params = [ new TLV(0x81, tlv.encodeTags(notificationIDs)) ];
  return new exports.DeviceCommand(device, CommandType.UNSUBSCRIBE, params, cb);
}

exports.DeviceManager.prototype.sendCommands = function(commands) {
  var groupedCommands = groupCommandsByPhysicalDevice(commands);
  
  groupedCommands.forEach(function(commandGroup, physicalDevice) {
    this.sendPacket(physicalDevice, commandGroup);    
  }.bind(this));
}

exports.DeviceManager.prototype.sendPacket = function(physicalDevice, commands) {
  this._connectorLoader.loadedModules[physicalDevice.connector].send(physicalDevice, this.createPacket(commands), processResponse.bind(this, commands)); 
}

exports.DeviceManager.prototype.createPacket = function(commands) {
  var packet = new TLV(0xE0, []);
  
  for (var i = 0, len = commands.length; i < len; i++) {
    var command = commands[i];
    var commandTLV = new TLV(command.type, []);
    
    if (command.device.parent) {
      commandTLV.value.push(new TLV(0x80, new Buffer([command.device.subdeviceID])));
    }
        
    Array.prototype.push.apply(commandTLV.value, command.parameters);
    packet.value.push(commandTLV);
  };
  
  return packet;
}

function processResponse(commands, responseTLV) {
  assert.equal(commands.length, responseTLV.value.length);
  
  for(var i = 0, len = commands.length; i < len; i++) {
    commands[i].callback(commands[i], responseTLV.value[i]);
  }
}

function handleGetInfoResponse(cb, command, responseTLV) {
  var error = responseTLV.getFirstChild(0x9E);
  
  if (error) {
    //do something, maybe repeat command?
  }
  
  var device = command.device;
  device.deviceInfo = responseTLV;
  cb(command.device);
  
  var subdeviceCount = responseTLV.getFirstChild(0x83);
  
  if (subdeviceCount) {
    var getInfoCommands = [];
    var count = subdeviceCount.getUIntValue();
    
    for(var i = 0; i < count; i++) {
      var child = new exports.Device(device.id, device.connector, device.protocolInfo, device, i);
      this._unpairedDevices.push(child);
      
      getInfoCommands.push(this.createGetDeviceInfoCommand(child, handleGetInfoResponse.bind(this, cb)));
    }
    
    this.sendCommands(getInfoCommands);
  }
}

function handleSubscribeResponse(command, responseTLV) {
  var error = responseTLV.getFirstChild(0x9E);
  
  if (error) {
    //do something, maybe repeat command?
  }
}

function handleUnsubscribeResponse(command, responseTLV) {
  var error = responseTLV.getFirstChild(0x9E);
  
  if (error) {
    //do something, maybe repeat command?
  }
}

function handleDiscoveredDevice(connectorName, cb, deviceID, deviceProtocolInfo) {
  var newDevice = new exports.Device(deviceID, connectorName, deviceProtocolInfo);
  var newFullID = newDevice.getFullID();
  
  if (this.getDeviceByFullID(newFullID) || findDeviceByFullID(this._unpairedDevices, newFullID)) {
    return;
  }
  
  this._unpairedDevices.push(newDevice);
  this.getDeviceInfo(newDevice, cb);
}

function groupCommandsByPhysicalDevice(commands) {
  var groupedCommands = new Map();
  for (var i = 0, len = commands.length; i < len; i++) {
    var command = commands[i];
    var physicalDevice = command.device.parent ? command.device.parent : command.device;
    var mapEntry = groupedCommands.get(physicalDevice);
    
    if (!mapEntry) {
      mapEntry = [];
      groupedCommands.set(physicalDevice, mapEntry);
    }
    
    mapEntry.push(command);
  };
  
  return groupedCommands;
}

function findDeviceByFullID(array, fullID) {
  for (var i = 0, len = array.length; i < len; i++) {
    var device = array[i];
    
    if (device.getFullID() == fullID) {
       return device;
     }
  };
  
  return null;
}

function initializeConnector(connectorName, connector) {
  console.log("Loading connector: " + connectorName);
  connector.start();
}

function destroyConnector(connectorName, connector) {
  // do I even need this?
  console.log("Unloading connector: " + connectorName);
}

exports.groupCommandsByPhysicalDevice = groupCommandsByPhysicalDevice;
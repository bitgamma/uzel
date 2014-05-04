require('es6-shim');

var assert = require('assert');
var events = require('events');
var path = require('path');
var util = require('util');
var tlv = require('tlv');
var TLV = tlv.TLV;
var PluginLoader = require('plugin-loader').PluginLoader;
var DeviceInfo = require('./device_info').DeviceInfo;
var Datastore = require('nedb');

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

exports.Device = function(connector, protocolInfo, subdeviceID) {
  this.connector = connector;
  this.protocolInfo = protocolInfo;
  this.physicalID = this.connector + "|" + this.protocolInfo.id;
  this.subdeviceID = subdeviceID;
  
  this.id = this.subdeviceID ? (this.physicalID + "#" + this.subdeviceID) : this.physicalID;
  this.deviceInfo = null;
  this.type = null;
  this.paired = false;
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
  this._pairedDevices = new Datastore({ filename: path.join(config.persistencyPath, 'devices.nedb') });
  this._unpairedDevices = [];
  this._subscriptions = new Map();
}

util.inherits(exports.DeviceManager, events.EventEmitter);

exports.DeviceType = DeviceType;
exports.CommandType = CommandType;
exports.DeviceManager.prototype.DeviceType = DeviceType;
exports.DeviceManager.prototype.CommandType = CommandType;

exports.DeviceManager.prototype.start = function(done) {  
  this._pairedDevices.loadDatabase(function() {
    this._connectorLoader.on('pluginLoaded', initializeConnector.bind(this))
    this._connectorLoader.on('pluginUnloaded', destroyConnector.bind(this))
    this._connectorLoader.startMonitoring();
    
    this._pairedDevices.ensureIndex({ fieldName: 'id', unique: true });
    this._pairedDevices.ensureIndex({ fieldName: 'type' });
    
    done();
  }.bind(this));
}

exports.DeviceManager.prototype.pair = function(device, pairingData, cb) {
  this._connectorLoader.loadedModules[device.connector].pair(device, pairingData, handlePairedDevice.bind(this, cb));
}

exports.DeviceManager.prototype.unpair = function(device, cb) {
  this._connectorLoader.loadedModules[device.connector].unpair(device, handleUnpairedDevice.bind(this, cb));
}

exports.DeviceManager.prototype.discoverDevices = function() {
  this._unpairedDevices.length = 0;
  
  for (var connectorName in this._connectorLoader.loadedModules) {
    this._connectorLoader.loadedModules[connectorName].discoverDevices();
  }
}

exports.DeviceManager.prototype.getPairedDevices = function(cb) {
  this._pairedDevices.find({}, function (err, devices) {
    cb(devices);
  });
}

exports.DeviceManager.prototype.getUnpairedDevices = function(cb) {
  cb(this._unpairedDevices.filter(function(device) { return device.deviceInfo != null; }));
}

exports.DeviceManager.prototype.getDevicesByType = function(types, cb) {
  if (!types || types.length == 0) {
    this.getPairedDevices(cb);
    return;
  } else if (!util.isArray(types)) {
    types = [ types ];
  }
  
  this._pairedDevices.find({ type: { $in: types }}, function (err, foundDevices) {
    cb(foundDevices);
  });  
}

exports.DeviceManager.prototype.getDevicesConnector = function(connector, cb) {
  this._pairedDevices.find({ connector: connector }, function (err, foundDevices) {
    cb(foundDevices);
  });  
}

exports.DeviceManager.prototype.getDeviceByID = function(id, cb) {  
  this._pairedDevices.findOne({ id: id }, function (err, device) {
    cb(device);
  });  
}

exports.DeviceManager.prototype.getUnpairedDeviceByID = function(id, cb) { 
  var device = this._unpairedDevices.find(function(device) {
    return device.id == id;
  });
  
  cb(device);   
}

exports.DeviceManager.prototype.getDeviceInfo = function(device, cb) {
  this.sendCommands([ this.createGetDeviceInfoCommand(device, handleGetInfoResponse.bind(this)) ]);
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

exports.DeviceManager.prototype.subscribe = function(device, notificationIDs, cb, errorCallback) {
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
    this.sendCommands([ createSubscribeCommand(device, stillUnsubscribedNotifications, handleSubscribtionResponse.bind(this, errorCallback)) ])
  }
}

exports.DeviceManager.prototype.createSubscribeCommand = function(device, notificationIDs, cb) {
  var params = [ new TLV(0x81, tlv.encodeTags(notificationIDs)) ];
  return new exports.DeviceCommand(device, CommandType.SUBSCRIBE, params, cb);
}

exports.DeviceManager.prototype.unsubscribe = function(device, notificationIDs, cb, errorCallback) {
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
    this.sendCommands([ createUnsubscribeCommand(device, notificationsToUnsubscribe, handleSubscribtionResponse.bind(this, errorCallback)) ])
  }
}

exports.DeviceManager.prototype.createUnsubscribeCommand = function(device, notificationIDs, cb) {
  var params = [ new TLV(0x81, tlv.encodeTags(notificationIDs)) ];
  return new exports.DeviceCommand(device, CommandType.UNSUBSCRIBE, params, cb);
}

exports.DeviceManager.prototype.sendCommands = function(commands) {
  var groupedCommands = groupCommandsByPhysicalDevice(commands);
  
  for (var physicalDeviceID in groupedCommands) {
    var commands = groupedCommands[physicalDeviceID];
    this.sendPacket(commands[0].device, commands);
  }
}

exports.DeviceManager.prototype.sendPacket = function(physicalDevice, commands) {
  this._connectorLoader.loadedModules[physicalDevice.connector].send(physicalDevice, this.createPacket(commands).encode(), processResponse.bind(this, commands)); 
}

exports.DeviceManager.prototype.createPacket = function(commands) {
  var packet = new TLV(0xE0, []);
  
  for (var i = 0, len = commands.length; i < len; i++) {
    var command = commands[i];
    var commandTLV = new TLV(command.type, []);
    
    if (command.device.subdeviceID !== undefined) {
      commandTLV.value.push(new TLV(0x80, new Buffer([command.device.subdeviceID])));
    }
        
    Array.prototype.push.apply(commandTLV.value, command.parameters);
    packet.value.push(commandTLV);
  };
  
  return packet;
}

function processResponse(commands, response) {
  var responseTLV = tlv.parse(response);
  
  assert.equal(commands.length, responseTLV.value.length);
  
  for(var i = 0, len = commands.length; i < len; i++) {
    commands[i].callback(commands[i], responseTLV.value[i]);
  }
}

function handleGetInfoResponse(command, responseTLV) {
  var error = responseTLV.getFirstChild(0x9E);
  
  if (error) {
    //do something, maybe repeat command?
  }
  
  var device = command.device;
  device.deviceInfo = new DeviceInfo(responseTLV);
  device.type = device.deviceInfo.type;
  
  this.emit('deviceDiscovered', command.device);
    
  if (device.deviceInfo.subdeviceCount) {
    var getInfoCommands = [];
    
    for(var i = 0; i < device.deviceInfo.subdeviceCount; i++) {
      var child = new exports.Device(device.connector, device.protocolInfo, i);
      this._unpairedDevices.push(child);
      
      getInfoCommands.push(this.createGetDeviceInfoCommand(child, handleGetInfoResponse.bind(this, cb)));
    }
    
    this.sendCommands(getInfoCommands);
  }
}

function handleSubscribtionResponse(errorCallback, command, responseTLV) {
  var error = responseTLV.getFirstChild(0x9E);
  
  if (error && errorCallback) {
    errorCallback(error.getIntValue());
  }
}

function handlePairedDevice(cb, device, err) {
  if (err) {
    cb(device, err);
    return;
  }
  
  device.paired = true;
  
  var idx = this._unpairedDevices.indexOf(device);
  
  if (idx != -1) {
    this._unpairedDevices.splice(idx);
  }
  
  this._pairedDevices.insert(device, function(insertErr, insertedDevice) {
    if (cb) {
      cb(insertedDevice);    
    }
  
    this.emit('devicePaired', insertedDevice);
  }.bind(this));  
}

function handleUnpairedDevice(cb, device, err) {
  if (err) {
    cb(device, err);
    return;
  }
  
  device.paired = false;
  
  db.remove({ id: device.id }, {}, function (err, numRemoved) {
    this._unpairedDevices.push(device);
    
    if (cb) {
      cb(device);    
    }
  
    this.emit('deviceUnpaired', device);
  }.bind(this));  
}

function handleDiscoveredDevice(connectorName, deviceProtocolInfo) {
  var newDevice = new exports.Device(connectorName, deviceProtocolInfo);
  var newID = newDevice.id;
  
  this.getUnpairedDeviceByID(newID, function(device) {
    if(!device) {
      this._unpairedDevices.push(newDevice);
      this.getDeviceInfo(newDevice);      
    }
  }.bind(this));
}

function groupCommandsByPhysicalDevice(commands) {
  var groupedCommands = {};
  for (var i = 0, len = commands.length; i < len; i++) {
    var command = commands[i];
    var mapEntry = groupedCommands[command.device.physicalID];
    
    if (!mapEntry) {
      mapEntry = [];
      groupedCommands[command.device.physicalID] = mapEntry;
    }
    
    mapEntry.push(command);
  };
  
  return groupedCommands;
}

function initializeConnector(connectorName, connector) {
  console.log('Loading connector: ' + connectorName);
  connector.on('deviceDiscovered', handleDiscoveredDevice.bind(this, connectorName));

  this.getDevicesConnector(connectorName, function(pairedDevices) {
    connector.start(pairedDevices);
  }.bind(this));
}

function destroyConnector(connectorName, connector) {
  connector.removeAllListeners();
  console.log('Unloading connector: ' + connectorName);
}

exports.groupCommandsByPhysicalDevice = groupCommandsByPhysicalDevice;
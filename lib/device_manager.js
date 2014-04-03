/*DeviceManager

#getDevices([type1, type2..]) => array of pair devices of the given type
#getUnpairedDevices(cb) => array devices not paired
#pair(device, cb)
#unpair(device, cb)

#scheduledSend(device, tlv, interval, cb)

device manager needs a db of paired devices!*/

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
  PAIR: 0xA1,
  GET_DATA: 0xA2,
  PERFORM: 0xA3,
  SUBSCRIBE: 0xA4,
  UNSUBSCRIBE: 0xA5,
  UNPAIR: 0xA6
};

exports.Device = function(type, connector, parentDevice, subdeviceID) {
  this.type = type;
  this.connector = connector;
  this.deviceInfo = null;
  this.parent = parentDevice;
  this.subdeviceID = subdeviceID;
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
  this._pairedDevices = [ new exports.Device(DeviceType.TEMPERATURE_SENSOR, 'ip') ]; // change this!!!
  this._unpairedDevices = [];
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

exports.DeviceManager.prototype.getDevices = function(types) {
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

exports.DeviceManager.prototype.createGetDeviceInfoCommand = function(device, cb) {
  return new exports.DeviceCommand(device, CommandType.GET_DEVICE_INFO, [], cb);
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

exports.DeviceManager.prototype.createSubscribeCommand = function(device, notificationIDs, cb) {
  var params = [ new TLV(0x81, tlv.encodeTags(notificationIDs)) ];
  return new exports.DeviceCommand(device, CommandType.SUBSCRIBE, params, cb);
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
  this._connectorLoader.loadedModules[physicalDevice.connector].send(physicalDevice, createPacket(commands), processResponse.bind(this, commands)); 
}

exports.DeviceManager.prototype.createPacket = function(commands) {
  var packet = new TLV(0xE0, []);
  
  commands.forEach(function(command) {
    var commandTLV = new TLV(command.type, []);
    
    if (command.device.subdeviceID) {
      commandTLV.value.push(new TLV(0x80, new Buffer([command.device.subdeviceID])));
    }
        
    Array.prototype.push.apply(commandTLV.value, command.parameters);
    packet.value.push(commandTLV);
  });
  
  return packet;
}

function processResponse(commands, responseTLV) {
  assert.equal(commands.length, responseTLV.value.length);
  
  for(var i = 0; i < commands.length; i++) {
    commands[i].callback(commands[i], responseTLV.value[i]);
  }
}

function groupCommandsByPhysicalDevice(commands) {
  var groupedCommands = new Map();
  commands.forEach(function(command) {
    var physicalDevice = command.device.parent ? command.device.parent : command.device;
    var mapEntry = groupedCommands.get(physicalDevice);
    
    if (!mapEntry) {
      mapEntry = [];
      groupedCommands.set(physicalDevice, mapEntry);
    }
    
    mapEntry.push(command);
  });
  
  return groupedCommands;
}

function initializeConnector(connectorName, connector) {
  // do something with the connector
  console.log("Loading connector: " + connectorName);
  connector.start();
}

function destroyConnector(connectorName, connector) {
  // do I even need this?
  console.log("Unloading connector: " + connectorName);
}
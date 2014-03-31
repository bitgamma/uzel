/*DeviceManager

#getDevices([type1, type2..]) => array of pair devices of the given type
#getUnpairedDevices(cb) => array devices not paired
#pair(device, cb)
#unpair(device, cb)

#scheduledSend(device, tlv, interval, cb)

device manager needs a db of paired devices!*/

var util = require('util');
var tlv = require('TLV');
var TLV = tlv.TLV;
var PluginLoader = require('plugin-loader').PluginLoader;

var DeviceType = {
  TEMPERATURE_SENSOR: 0x0001,
  MOISTURE_SENSOR: 0x0002,
  VELOCITY_SENSOR: 0x0003,
};

var CommandTypes = {
  GET_DEVICE_INFO: 0xA0,
  PAIR: 0xA1,
  GET_DATA: 0xA2,
  PERFORM: 0xA3,
  SUBSCRIBE: 0xA4,
  UNSUBSCRIBE: 0xA5,
  UNPAIR: 0xA6
};

exports.DeviceManager = function DeviceManager(config) {
  this._connectorLoader = new PluginLoader(config.connectorDirectories);
  this._config = config;
  this._pairedDevices = [];
  this._unpairedDevices = [];
}

exports.DeviceManager.prototype.DeviceType = DeviceType;
exports.DeviceManager.prototype.CommandTypes = CommandTypes;

exports.DeviceManager.prototype.start = function(done) {
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
  });
  
  return foundDevices;
}

exports.DeviceManager.prototype.getData = function(device, options, cb) {
  if (options instanceof Function) {
    cb = options;
    options = [];
  }
  
  var params;
  
  if (options.length >= 0) {
    params = [ new TLV(0xA0, options) ];
  } else {
    params = null;
  }
  
  this.sendCommands([ { device: device, type: CommandType.GET_DATA, parameters: params callback: cb } ]);
}

exports.DeviceManager.prototype.sendCommands = function(commands) {
  var groupedCommands = groupCommandsByPhysicalDevice(commands);
  
  for (var physicalDevice in groupedCommands) {
    sendPacket(physicalDevice, groupedCommands[physicalDevice]);
  }
}

exports.DeviceManager.prototype.sendPacket = function(physicalDevice, commands) {
  var packet = new TLV(0xE0, []);
  
  commands.forEach(function(command) {
    var commandTLV = new TLV(command.type, []);
    if (command.device.subdevice) {
      commandTLV.value.push(new TLV(0x80, new Buffer([command.device.subdevice])));
      Array.prototype.push.apply(commandTLV.value, command.parameters);
    }
  });
  
  this._connectorLoader.loadedModules[physicalDevice.connector].send(physicalDevice, tlv, processResponse.bind(this, commands)); 
}

function processResponse(commands, response) {
  
}

function groupCommandByPhysicalDevice(commands) {
  var groupedCommands = {};
  commands.forEach(function(command) {
    var physicalDevice = command.device.parent ? command.device.parent : command.device;
    groupedCommands[physicalDevice] = groupedCommands[physicalDevice] ? groupedCommands[physicalDevice] : [];
    groupedCommands[physicalDevice].push(command);
  });
  
  return groupedCommands;
}

function initializeConnector(connectorName, connector) {
  console.log("Loading connector: " + connectorName);
  connector.start();
}

function destroyConnector(connectorName, connector) {
  console.log("Unloading connector: " + connectorName);
}
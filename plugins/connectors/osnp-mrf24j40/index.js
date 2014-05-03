var events = require('events');
var util = require('util');

var mrf24j40 = require('node-mrf24j40');
var MRF24J40 = mrf24j40.MRF24J40;
var ControlRegister = mrf24j40.ControlRegister;
var FIFO = mrf24j40.FIFO;

var osnp = require('node-osnp');
var OSNPAddressTable = osnp.OSNPAddressTable;
var OSNPCommandQueue = osnp.OSNPCommandQueue;
var FrameType = osnp.FrameType;
var FrameVersion = osnp.FrameVersion;
var AddressingMode = osnp.AddressingMode;
var MACCommand = osnp.MACCommand;

var radio;
var txQueue;
var txFrame;

var addressTable;
var deviceQueues;

var deviceDiscoveryPeriods;

module.exports = new events.EventEmitter();
exports = module.exports;

function QueuedFrame(frame, callback) {
  this.frame = frame;
  this.callback = callback;
}

exports.start = function() {
  if (process.platform == 'linux') {
    radio = new MRF24J40('raspi');    
  }
  
  // This must be persistent
  addressTable = new OSNPAddressTable();
  deviceQueues = {};
  txQueue = [];
  txFrame = null;

  osnp.setPANID(new Buffer([0xfe, 0xca]));
  osnp.setShortAddress(new Buffer([0x00, 0x00]));      
  
  if (radio) {
    radio.on('frame', handleReceived);
    radio.on('transmitted', handleTransmitted);
    radio.initialize();
    radio.setPANCoordinator();
    radio.setPANID(osnp.getPANID());
    radio.setShortAddress(osnp.getShortAddress());      
    radio.setChannel(2);
  }
}

exports.discoverDevices = function() {
  deviceDiscoveryPeriods = 0;
  transmitDiscoveryRequest();
}

exports.pair = function(device, pairingData, cb) {
  device.protocolInfo.shortAddress = new Buffer(2);
  device.protocolInfo.shortAddress.writeUInt16LE(addressTable.allocate(), 0);
  var frame = osnp.createPairingCommand(device.protocolInfo.eui, device.protocolInfo.shortAddress);
  addToQueue(frame, device, cb, device.protocolInfo.shortAddress);
}

exports.unpair = function(device, cb) {
  var frame = osnp.createUnpairingCommand(device.protocolInfo.shortAddress);
  addToQueue(frame, device, cb);
}

exports.send = function(device, data, cb) {  
  var frame = osnp.createCommandPacket(data, device.protocolInfo.eui, device.protocolInfo.shortAddress, device.paired);
  addToQueue(frame, device, cb);
}

function getQueue(address) {
  var queue = deviceQueues[address.toString('hex')];
  
  if (!queue) {
    queue = new OSNPCommandQueue();
    deviceQueues[address.toString('hex')] = queue;
  }
  
  return queue;
}

function tryDequeue(queue) {
  var cmd = queue.dequeue();
  
  if (cmd) {
    txQueue.push(cmd.frame);
    tryTransmit();
  }
}

function addToQueue(frame, device, cb, address) {
  if (!address) {
    address = frame.destinationAddress;
  }
  
  var queue = getQueue(address, device);
  queue.device = device;
  queue.queue(new QueuedFrame(frame, cb)); 
  tryDequeue(queue); 
}

function transmitDiscoveryRequest() {
  var frame = osnp.createDiscoveryRequest();
  txQueue.push(frame);
  tryTransmit();
  
  if (deviceDiscoveryPeriods < 240) {
    deviceDiscoveryPeriods++;
    setTimeout(transmitDiscoveryRequest, 250);
  } else {
    exports.emit('deviceDiscoveryFinished');
  }
}

function tryTransmit() {
  if (!txFrame && (txQueue.length > 0)) {
    var frame = txQueue.shift();
    txFrame = frame;
    var frameLength = frame.getEncodedLength();
    var buf = new Buffer(frameLength + 2);
    buf[0] = frameLength - frame.payload.length;
    buf[1] = frameLength;
    frame.encode(buf.slice(2));
    radio.transmit(buf);
  }
}

function handleMACFrame(frame) {  
  switch (frame.payload[0]) {
  case MACCommand.ASSOCIATION_RESPONSE:
    //TODO: handle error
    var queue = getQueue(frame.sourceAddress);
    var cmd = queue.deviceResponded();
    delete deviceQueues[cmd.device.protocolInfo.eui];
    cmd.callback(cmd.device);
    tryDequeue(queue);
    break;
  case MACCommand.DATA_REQUEST:
    break;
  case MACCommand.DISCOVER:
    var protocolInfo = new OSNPProtocolInfo(frame.sourceAddress);
    exports.emit('deviceDiscovered', protocolInfo.toID(), protocolInfo);
    break;
  }
}

function handleDataFrame(frame) {
  var queue = getQueue(frame.sourceAddress);  
  
  //TODO: what if the queue has not been created yet? need to sort this at initialization, I think
  if (frame.payload[0] == 0xE2) {
    exports.emit('notificationReceived', queue.device, frame.payload);
    return;
  }

  var cmd = queue.deviceResponded();
  cmd.callback(frame.payload);
  tryDequeue(queue); 
}

function handleReceived(rawFrame, lqi, rssi) {
  var frame = osnp.parseFrame(rawFrame);
  
  switch(frame.getFrameType()) {
  case FrameType.MAC_CMD:
    handleMACFrame(frame);
    break;
  case FrameType.DATA:
    handleDataFrame(frame);
    break;      
  }
}

function handleTransmitted(txErr, ccaErr) {
  if(ccaErr) {
    txQueue.push(txFrame);
  } else if (txErr) {
    var queue = getQueue(txFrame.destinationAddress);
    var sentCmd = queue.deviceResponded();
    //TODO: handle error by invoking callback with a proper error code
  } else if (txFrame.payload[0] == MACCommand.DISASSOCIATED) {
    var queue = getQueue(txFrame.destinationAddress);
    addressTable.free(queue.device.protocolInfo.shortAddress);
    var cmd = queue.deviceResponded();
    cmd.callback(device);
    tryDequeue(queue); 
  }
  
  txFrame = null;
  tryTransmit();
}

function OSNPProtocolInfo(eui) {
  this.eui = eui;
  this.shortAddress = null;
  this.capabilities = null;
}

OSNPProtocolInfo.prototype.toID = function() {
  return this.eui.toString('hex');
}


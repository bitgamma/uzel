var mrf24j40 = require('node-mrf24j40');
var MRF24J40 = mrf24j40.MRF24J40;
var ControlRegister = mrf24j40.ControlRegister;
var FIFO = mrf24j40.FIFO;

var osnp = require('node-osnp');
var FrameType = osnp.FrameType;
var FrameVersion = osnp.FrameVersion;
var AddressingMode = osnp.AddressingMode;
var MACCommand = osnp.MACCommand;

var radio;
var frameQueue = [];
var cbCache = {};
var transmissionPending = null;

var deviceDiscoveryPeriods;
var discoveryCallback;
var pairingCallback;
var unpairingCallback;

var nextFreeShortAddress;

exports.start = function() {
  if (process.platform == 'linux') {
    radio = new MRF24J40('raspi');    
  }
  
  // This must be persistent and must use a list instead
  nextFreeShortAddress = 0x0001;

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

exports.pair = function(device, pairingData, cb) {
  pairingCallback = cb.bind(null, device);
  var frameControlLow = osnp.makeFrameControlLow(FrameType.MAC_CMD, false, false, true, false);
  var frameControlHigh = osnp.makeFrameControlHigh(AddressingMode.EUI, FrameVersion.V2003, AddressingMode.SHORT_ADDRESS);
  
  var frame = osnp.createFrame(frameControlLow, frameControlHigh);
  frame.destinationPAN = new Buffer([0x00, 0x00]);   
  frame.destinationAddress = device.protocolInfo.eui;
  
  device.protocolInfo.shortAddress = new Buffer(2);
  device.protocolInfo.shortAddress.writeUInt16LE(nextFreeShortAddress++, 0);
  
  frame.payload = new Buffer([MACCommand.ASSOCIATION_REQUEST, device.protocolInfo.shortAddress[0], device.protocolInfo.shortAddress[1]]);
  frameQueue.push(frame);
  trySend();
}

exports.unpair = function(device, cb) {
  unpairingCallback = cb.bind(null, device);
  var frameControlLow = osnp.makeFrameControlLow(FrameType.MAC_CMD, false, false, true, false);
  var frameControlHigh = osnp.makeFrameControlHigh(AddressingMode.SHORT_ADDRESS, FrameVersion.V2003, AddressingMode.NOT_PRESENT);
  
  var frame = osnp.createFrame(frameControlLow, frameControlHigh);
  frame.destinationPAN = osnp.getPANID();
  frame.destinationAddress = device.protocolInfo.shortAddress;
  frame.payload = new Buffer([MACCommand.DISASSOCIATED]);
  frameQueue.push(frame);
  trySend();
}

exports.discoverDevices = function(cb) {
  deviceDiscoveryPeriods = 0;
  discoveryCallback = cb;
  
  sendDiscoveryFrame();
}

exports.send = function(device, data, cb) {  
  var frameControlLow = osnp.makeFrameControlLow(FrameType.DATA, false, false, true, false);
  var frameControlHigh;
  
  if (device.paired) {
    frameControlHigh = osnp.makeFrameControlHigh(AddressingMode.SHORT_ADDRESS, FrameVersion.V2003, AddressingMode.NOT_PRESENT);
  } else {
    frameControlHigh = osnp.makeFrameControlHigh(AddressingMode.EUI, FrameVersion.V2003, AddressingMode.SHORT_ADDRESS);    
  }
  
  var frame = osnp.createFrame(frameControlLow, frameControlHigh);
  
  if (device.paired) {
    frame.destinationPAN = osnp.getPANID();
    frame.destinationAddress = device.protocolInfo.shortAddress;    
  } else {
    frame.destinationPAN = new Buffer([0x00, 0x00]);   
    frame.destinationAddress = device.protocolInfo.eui;    
  }
  
  frame.payload = data;
  
  frameQueue.push(frame);
  cbCache[frame.destinationAddress.toString('hex')] = cb;
  trySend();
}

function sendDiscoveryFrame() {
  var frameControlLow = osnp.makeFrameControlLow(FrameType.MAC_CMD, false, false, false, false);
  var frameControlHigh = osnp.makeFrameControlHigh(AddressingMode.SHORT_ADDRESS, FrameVersion.V2003, AddressingMode.SHORT_ADDRESS);
  
  var frame = osnp.createFrame(frameControlLow, frameControlHigh);
  frame.destinationPAN = new Buffer([0x00, 0x00]);
  frame.destinationAddress = new Buffer([0xff, 0xff]);
  frame.payload = new Buffer([MACCommand.DISCOVER]);
  frameQueue.push(frame);
  trySend();
  
  if (deviceDiscoveryPeriods < 240) {
    deviceDiscoveryPeriods++;
    setTimeout(sendDiscoveryFrame, 250);
  }
}

function trySend() {
  if (!transmissionPending && (frameQueue.length > 0)) {
    var frame = frameQueue.shift();
    transmissionPending = frame;
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
    pairingCallback();
    break;
  case MACCommand.DATA_REQUEST:
    break;
  case MACCommand.DISCOVER:
    var protocolInfo = new OSNPProtocolInfo(frame.sourceAddress);
    discoveryCallback(protocolInfo.toID(), protocolInfo);
    break;
  }
}

function handleDataFrame(frame) {
  var cb = cbCache[frame.sourceAddress.toString('hex')];
  
  //TODO: what to do with data generated by the device (notification)
  if (cb) {
    delete cbCache[frame.sourceAddress.toString('hex')];
    cb(frame.payload);
  }  
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
    frameQueue.push(transmissionPending);
  } else if (txErr) {
    delete cbCache[transmissionPending.destinationAddress.toString('hex')];    
  } else if (transmissionPending.payload[0] == MACCommand.DISASSOCIATED) {
    unpairingCallback();
    unpairingCallback = null;
  }
  
  transmissionPending = null;
  trySend();
}

function OSNPProtocolInfo(eui) {
  this.eui = eui;
  this.shortAddress = null;
  this.capabilities = null;
}

OSNPProtocolInfo.prototype.toID = function() {
  return this.eui.toString('hex');
}


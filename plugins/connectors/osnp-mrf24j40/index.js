var events = require('events');
var util = require('util');
var crypto = require('crypto');

var mrf24j40 = require('node-mrf24j40');
var MRF24J40 = mrf24j40.MRF24J40;
var ControlRegister = mrf24j40.ControlRegister;
var FIFO = mrf24j40.FIFO;

var osnp = require('node-osnp');
var OSNPAddressTable = osnp.OSNPAddressTable;
var OSNPCommandQueue = osnp.OSNPCommandQueue;
var FrameType = osnp.FrameType;
var AddressingMode = osnp.AddressingMode;
var MACCommand = osnp.MACCommand;
var SecurityLevel = osnp.SecurityLevel;
var RXMode = osnp.RXMode;

var radio;
var txQueue;
var txFrame;

var addressTable;
var deviceQueues;

var deviceDiscoveryPeriods;

module.exports = new events.EventEmitter();
exports = module.exports;

function QueuedFrame(frame, timeout, callback) {
  this.frame = frame;
  this.osnpTransmissionTimeout = timeout;
  this.callback = callback;
}

exports.allowMultipleCommandsInPacket = false;

exports.start = function(pairedDevices) {
  deviceQueues = {};
  txQueue = [];
  txFrame = null;
  
  var initAddresses = [];
  
  for(var i = 0, len = pairedDevices.length; i < len; i++) {
    queue = new OSNPCommandQueue();
    queue.device = pairedDevices[i];
    deviceQueues[queue.device.protocolInfo.shortAddress.toString('hex')] = queue;
    deviceQueues[queue.device.protocolInfo.eui.toString('hex')] = queue;
    initAddresses.push(queue.device.protocolInfo.shortAddress.readUInt16LE(0));
  }

  addressTable = new OSNPAddressTable(initAddresses);
  
  if (process.platform == 'linux') {
    radio = new MRF24J40('linux');    
  }

  osnp.setPANID(new Buffer([0xfe, 0xca]));
  osnp.setShortAddress(new Buffer([0x00, 0x00]));     
  //TODO: make this configurable or read from somewhere 
  osnp.setEUI(new Buffer([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17]));      
  
  if (radio) {
    radio.on('frame', handleReceived);
    radio.on('securedFrame', handleSecuredFrame);
    radio.on('transmitted', handleTransmitted);
    radio.initialize();
    radio.setPANCoordinator();
    radio.setPANID(osnp.getPANID());
    radio.setEUI(osnp.getEUI());
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
  device.protocolInfo.txKey = pairingData;
  device.protocolInfo._txKey = crypto.randomBytes(16);
  device.protocolInfo.rxKey = crypto.randomBytes(16);
  queue.device.protocolInfo.securityLevel = SecurityLevel.AES_CCM_64;

  var frame = osnp.createPairingCommand(device.protocolInfo.eui, device.protocolInfo.shortAddress, device.protocolInfo._txKey, device.protocolInfo.rxKey);
  deviceQueues[device.protocolInfo.shortAddress.toString('hex')] = deviceQueues[device.protocolInfo.eui.toString('hex')];
  addToQueue(frame, device, 1000, cb);
}

exports.unpair = function(device, cb) {
  var frame = osnp.createUnpairingCommand(device.protocolInfo.shortAddress);
  addToQueue(frame, device, 1000, cb);
}

exports.send = function(device, data, timeout, cb) {  
  var frame = osnp.createCommandPacket(data, device.protocolInfo.eui, device.protocolInfo.shortAddress, device.paired);
  addToQueue(frame, device, timeout, cb);
}

function tryUnsetFramePending() {
  var empty = true;
  
  for(var queueName in deviceQueues) {
    var queue = deviceQueues[queueName];
    
    if (isPollDriven(queue.device) && !queue.isEmpty()) {
      empty = false;
      break;
    }
  }
  
  if (empty) {
    radio.setDataRequestFramePending(false);
  }
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
  var cmd;
  
  if (!isPollDriven(queue.device)) {
    cmd = queue.dequeue();
  } else if (queue.active) {
    cmd = queue.dequeue();

    if (!cmd || queue.isEmpty()) {
      queue.active = false;
    } else {
      //add the frame pending bit
      cmd.frame.frameControlLow = cmd.frame.frameControlLow | 0x10;
    }
  }
  
  if (cmd) {
    txQueue.push({ securityInfo: queue.device.protocolInfo, frame: cmd.frame });
    tryTransmit();
  }
  
  tryUnsetFramePending();
}

function addToQueue(frame, device, timeout, cb) {  
  if (isPollDriven(device)) {
    radio.setDataRequestFramePending(true);
  }
  
  var queue = getQueue(frame.destinationAddress);
  queue.device = device;
  queue.queue(new QueuedFrame(frame, timeout, cb)); 
  tryDequeue(queue); 
}

function transmitDiscoveryRequest() {
  var frame = osnp.createDiscoveryRequest();
  txQueue.push({ frame: frame });
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
    
    if (frame.frame.hasSecurityEnabled()) {
      radio.setCipher(false, false, frame.securityInfo.securityLevel, frame.securityInfo.securityLevel);
      radio.setTXNSecurityKey(frame.securityInfo.txKey);
      frame.frame.frameCounter = frame.securityInfo.txFrameCounter++;
      //TODO: the device needs to be updated in the db
    }
    
    var frameLength = frame.frame.getEncodedLength();
    var buf = new Buffer(frameLength + 2);
    buf[0] = frameLength - frame.frame.payload.length;
    buf[1] = frameLength;
    frame.frame.encode(buf.slice(2));
    radio.transmit(buf);
  }
}

function handleMACFrame(frame) {  
  switch (frame.payload[0]) {
  case MACCommand.ASSOCIATION_RESPONSE:
    //TODO: handle error
    var queue = getQueue(frame.sourceAddress);
    
    if (queue.device) {
      var cmd = queue.deviceResponded();
      
      if (cmd) {
        queue.device.protocolInfo.capabilities = frame.payload[1];
        queue.device.protocolInfo.securityLevel = frame.payload[2];
        queue.device.protocolInfo.txKey = queue.device.protocolInfo._txKey;
        delete queue.device.protocolInfo['_txKey'];
        //TODO: update db
        cmd.callback(queue.device);
      }

      tryDequeue(queue);
    }
    break;
  case MACCommand.DATA_REQUEST:
    var queue = getQueue(frame.sourceAddress);
    
    if (queue.device) {
      queue.active = true;
      tryDequeue(queue);      
    }
    break;
  case MACCommand.DISCOVER:
    var protocolInfo = new OSNPProtocolInfo(frame.sourceAddress);
    exports.emit('deviceDiscovered', protocolInfo);
    break;
  }
}

function handleDataFrame(frame) {
  var queue = getQueue(frame.sourceAddress);  
  
  if (!queue.device) {
    return;
  }
  
  if (frame.payload[0] == 0xE2) {
    exports.emit('notificationReceived', queue.device, frame.payload);
    return;
  }

  var cmd = queue.deviceResponded();
  
  if (cmd) {
    cmd.callback(frame.payload);    
  }
  
  tryDequeue(queue); 
}

function handleSecuredFrame(rawFrame) {
  var frame = osnp.parseFrame(rawFrame);
  var queue = getQueue(frame.sourceAddress);  
  
  if (!queue.device) {
    radio.setCipher(false, true, 0x00, 0x00);
    return;
  }
  
  radio.setRXSecurityKey(queue.device.protocolInfo.rxKey);
  radio.setCipher(true, false, queue.device.protocolInfo.securityLevel, queue.device.protocolInfo.securityLevel);
}

function handleReceived(rawFrame, lqi, rssi) {
  //TODO: check security and counter
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
    delete deviceQueues[queue.device.protocolInfo.shortAddress];
    delete deviceQueues[queue.device.protocolInfo.eui];
    addressTable.free(queue.device.protocolInfo.shortAddress);
    var cmd = queue.deviceResponded();
    cmd.callback(queue.device);
  }
  
  txFrame = null;
  tryTransmit();
}

function isPollDriven(device) {
  return (device.protocolInfo.capabilities !== null && ((device.protocolInfo.capabilities & 0x01) == RXMode.POLL_DRIVEN));
} 

function OSNPProtocolInfo(eui) {
  this.eui = new Buffer(eui.length);
  eui.copy(this.eui);
  this.shortAddress = null;
  this.capabilities = null;
  this.securityLevel = null;
  this.rxKey = null;
  this.txKey = null;
  this.rxFrameCounter = 0;
  this.txFrameCounter = 0;
  this.id = this.eui.toString('hex');
}

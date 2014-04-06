var tlv = require('tlv');
var net = require('net');

exports.start = function() {
  
}

exports.discoverDevices = function(cb) {
  //substitute with real code, maybe db, maybe SSDP, maybe both?
  var discoveredDevices = [ new IPProtocolInfo('127.0.0.1', 4000) ];

  for(var i = 0, len = discoveredDevices.length; i < len; i++) {
    var dev = discoveredDevices[i];
    cb(dev.toID(), dev);
  }
}

exports.send = function(device, tlvData, cb) {  
  var client = net.connect(device.protocolInfo.port, device.protocolInfo.address, function() {
    client.on('data', function(data) {
      client.end();
      cb(tlv.parse(data));
    });
  
    client.write(tlvData.encode());
  });
}

function IPProtocolInfo(address, port) {
  this.address = address;
  this.port = port;
}

IPProtocolInfo.prototype.toID = function() {
  return this.address + ":" + this.port;
}


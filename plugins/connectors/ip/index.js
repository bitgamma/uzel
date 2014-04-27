var net = require('net');

exports.start = function() {
  
}

exports.pair = function(device, pairingData, cb) {
  //maybe establish connection here
  cb(device);
}

exports.unpair = function(device, cb) {
  //drop connection here
  cb(device);
}

exports.discoverDevices = function(cb) {
  //substitute with real code, maybe db, maybe SSDP, maybe both?
  var discoveredDevices = [];

  for(var i = 0, len = discoveredDevices.length; i < len; i++) {
    var dev = discoveredDevices[i];
    cb(dev.toID(), dev);
  }
}

exports.send = function(device, data, cb) {  
  //the connection should probably be already open
  var client = net.connect(device.protocolInfo.port, device.protocolInfo.address, function() {
    client.on('data', function(responseData) {
      client.end();
      cb(responseData);
    });
  
    client.write(data);
  });
}

function IPProtocolInfo(address, port) {
  this.address = address;
  this.port = port;
}

IPProtocolInfo.prototype.toID = function() {
  return this.address + ":" + this.port;
}


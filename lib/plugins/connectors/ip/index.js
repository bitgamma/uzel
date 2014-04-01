/*#discoverDevices(cb)
#pair(device, data, cb)
#unpair(device, data, cb)
#send(device, data, cb)*/

var tlv = require('tlv');
var net = require('net');

exports.start = function() {
  
}

exports.send = function(device, tlvData, cb) {  
  //substitute with real code...
  var client = net.connect(4000, '127.0.0.1', function() {
    client.on('data', function(data) {
      client.end();
      cb(tlv.parse(data));
    });
  
    client.write(tlvData.encode());
  });
}
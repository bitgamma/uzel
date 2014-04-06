var tlv = require('tlv');
var TLV = tlv.TLV;

var availableDevices = [ 
  new MockProtocolInfo('mock',
    new TLV(0xE1, [
      new TLV(0xA0, [
        new TLV(0x81, new Buffer([0x00, 0x01])),
        new TLV(0x82, tlv.encodeTags([0xA0, 0xA2])),
        new TLV(0xC0, new Buffer("Mock Thermometer")),
      ])
    ])
  )
];

exports.start = function() {
  
}

exports.discoverDevices = function(cb) {
  for(var i = 0, len = availableDevices.length; i < len; i++) {
    var dev = availableDevices[i];
    cb(dev.id, dev);
  }
}

exports.send = function(device, tlvData, cb) {  
  cb(device.protocolInfo.getInfoData);
}

function MockProtocolInfo(id, getInfoData) {
  this.id = id;
  this.getInfoData = getInfoData;
}

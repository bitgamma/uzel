var tlv = require('tlv');
var TLV = tlv.TLV;

var availableDevices = [ 
  new MockProtocolInfo('mock',
    new TLV(0xE1, [
      new TLV(0xA0, [
        new TLV(0x81, new Buffer([0x00, 0x01])),
        new TLV(0x82, tlv.encodeTags([0xA0, 0xA2])),
        new TLV(0x83, new Buffer([0x02])),
        new TLV(0xC0, new Buffer("Mock Thermometer 1")),
      ])
    ]),
    new TLV(0xE1, [
      new TLV(0xA0, [
        new TLV(0x81, new Buffer([0x00, 0x01])),
        new TLV(0x82, tlv.encodeTags([0xA0, 0xA2])),
        new TLV(0xC0, new Buffer("Mock Thermometer 2")),
      ]),
      new TLV(0xA0, [
        new TLV(0x81, new Buffer([0x00, 0x01])),
        new TLV(0x82, tlv.encodeTags([0xA0, 0xA2])),
        new TLV(0xC0, new Buffer("Mock Thermometer 3")),
      ])
    ])
  )
];

exports.start = function() {
  
}

exports.pair = function(device, pairingData, cb) {
  cb(device);
}

exports.unpair = function(device, cb) {
  cb(device);
}

exports.discoverDevices = function(cb) {
  for(var i = 0, len = availableDevices.length; i < len; i++) {
    var dev = availableDevices[i];
    cb(dev);
  }
}

exports.send = function(device, data, cb) { 
  var tlvData = tlv.parse(data);
  
  if (tlvData.value[0].tag == 0xA0) {
    if (tlvData.value[0].getFirstChild(0x80)) {
      cb(device.protocolInfo.subdeviceInfo.encode());     
    } else {
      cb(device.protocolInfo.getInfoData.encode());
    }
  }
}

function MockProtocolInfo(id, getInfoData, subdeviceInfo) {
  this.id = id;
  this.getInfoData = getInfoData;
  this.subdeviceInfo = subdeviceInfo;
}

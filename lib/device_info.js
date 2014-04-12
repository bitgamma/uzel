var tlv = require('tlv');

exports.DeviceInfo = function(rawData) {
  this.subdeviceAddress = getDataOrUndefined(rawData, 0x80, tlv.TLV.prototype.getUIntValue);
  this.type = getDataOrUndefined(rawData, 0x81, tlv.TLV.prototype.getUIntValue);
  this.supportedCommands = getDataOrUndefined(rawData, 0x82, decodeTagList);
  this.subdeviceCount = getDataOrUndefined(rawData, 0x83, tlv.TLV.prototype.getUIntValue);
  this.supportedConfigurationOptions = getDataOrUndefined(rawData, 0x84, decodeTagList);
  this.supportedGetDataOptions = getDataOrUndefined(rawData, 0x85, decodeTagList);
  this.supportedPerformActions = getDataOrUndefined(rawData, 0x86, decodeTagList);
  this.supportedNotifications = getDataOrUndefined(rawData, 0x87, decodeTagList);
  this.name = getDataOrUndefined(rawData, 0xC0, decodeUTF8String);
  this.manufacturer = getDataOrUndefined(rawData, 0xC1, decodeUTF8String);
}

function getDataOrUndefined(rawData, tag, filter) {
  var data = rawData.getFirstChild(tag);
  
  if (data) {
    return filter.call(data);
  }
  
  return undefined;
}

function decodeTagList() {
  return tlv.parseAllTags(this.value);
}

function decodeUTF8String() {
  return this.value.toString('utf8');
}

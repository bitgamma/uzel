describe('DeviceManager', function() {
  var chai = require('chai');
  var device_manager = require('../lib/device_manager.js');
  var DeviceManager = device_manager.DeviceManager;
  var EventEmitter = require('events').EventEmitter;
  var tlv = require('tlv');
  var TLV = tlv.TLV;
  chai.should();

  var mock_connector = require('./mock_connector');  
  var mockDevice = new device_manager.Device('mock', 'mock');
  var subMockDevice = new device_manager.Device('mock', 'mock', null, mockDevice, 0);
  var secondMockDevice = new device_manager.Device('mock2', 'mock');
  
  describe('#DeviceManager', function() {
    it('should return an instance of DeviceManager', function() {
			var dm = new DeviceManager({});
      dm.should.be.instanceof(EventEmitter);
    });
  });
  
  describe('#createGetDeviceInfoCommand', function() {    
    it('should return a DeviceCommand for GET DEVICE INFO', function() {
			var dm = new DeviceManager({});
      var cb = function() {};
      var command = dm.createGetDeviceInfoCommand(mockDevice, cb);
      command.should.be.instanceof(device_manager.DeviceCommand);
      command.device.should.equal(mockDevice);
      command.type.should.equal(device_manager.CommandType.GET_DEVICE_INFO);
      command.parameters.length.should.equal(0);
      command.callback.should.equals(cb);
    });
  });

  describe('#createConfigureCommand', function() {
    it('should return a DeviceCommand for CONFIGURE', function() {
			var dm = new DeviceManager({});
      var param = new TLV(0x82, new Buffer([0xBA, 0xBA]));
      var cb = function() {};
      var command = dm.createConfigureCommand(mockDevice, [ param ], cb);
      command.should.be.instanceof(device_manager.DeviceCommand);
      command.device.should.equal(mockDevice);
      command.type.should.equal(device_manager.CommandType.CONFIGURE);
      command.parameters.length.should.equal(1);
      command.parameters[0].tag.should.equal(0xA0);
      command.parameters[0].getFirstChild(0x82).should.deep.equal(param);
      command.callback.should.equals(cb);
    });
  });
  
  describe('#createGetDataCommand', function() {
    it('should return a DeviceCommand for GET DATA with parameters', function() {
			var dm = new DeviceManager({});
      var param = new TLV(0x82, new Buffer([0xBA, 0xBA]));
      var cb = function() {};
      var command = dm.createGetDataCommand(mockDevice, [ param ], cb);
      command.should.be.instanceof(device_manager.DeviceCommand);
      command.device.should.equal(mockDevice);
      command.type.should.equal(device_manager.CommandType.GET_DATA);
      command.parameters.length.should.equal(1);
      command.parameters[0].tag.should.equal(0xA0);
      command.parameters[0].getFirstChild(0x82).should.deep.equal(param);
      command.callback.should.equals(cb);
    });
    
    it('should return a DeviceCommand for GET DATA without parameters', function() {
			var dm = new DeviceManager({});
      var cb = function() {};
      var command = dm.createGetDataCommand(mockDevice, cb);
      command.should.be.instanceof(device_manager.DeviceCommand);
      command.device.should.equal(mockDevice);
      command.type.should.equal(device_manager.CommandType.GET_DATA);
      command.parameters.length.should.equal(0);
      command.callback.should.equals(cb);
    });
  });
  
  describe('#createPerformCommand', function() {
    it('should return a DeviceCommand for PERFORM with parameters', function() {
			var dm = new DeviceManager({});
      var param = new TLV(0x82, new Buffer([0xBA, 0xBA]));
      var cb = function() {};
      var command = dm.createPerformCommand(mockDevice, 0x90, [ param ], cb);
      command.should.be.instanceof(device_manager.DeviceCommand);
      command.device.should.equal(mockDevice);
      command.type.should.equal(device_manager.CommandType.PERFORM);
      command.parameters.length.should.equal(2);
      command.parameters[0].tag.should.equal(0x81);
      command.parameters[0].value.should.deep.equal(new Buffer([0x90]));
      command.parameters[1].tag.should.equal(0xA0);
      command.parameters[1].getFirstChild(0x82).should.deep.equal(param);
      command.callback.should.equals(cb);
    });
    
    it('should return a DeviceCommand for PERFORM without parameters', function() {
			var dm = new DeviceManager({});
      var cb = function() {};
      var command = dm.createPerformCommand(mockDevice, 0x90, cb);
      command.should.be.instanceof(device_manager.DeviceCommand);
      command.device.should.equal(mockDevice);
      command.type.should.equal(device_manager.CommandType.PERFORM);
      command.parameters.length.should.equal(1)
      command.parameters[0].tag.should.equal(0x81);
      command.parameters[0].value.should.deep.equal(new Buffer([0x90]));
      command.callback.should.equals(cb);
    });
  });
  
  describe('#createSubscribeCommand', function() {    
    it('should return a DeviceCommand for SUBSCRIBE', function() {
			var dm = new DeviceManager({});
      var cb = function() {};
      var command = dm.createSubscribeCommand(mockDevice, [0xA2, 0xA1, 0xA4], cb);
      command.should.be.instanceof(device_manager.DeviceCommand);
      command.device.should.equal(mockDevice);
      command.type.should.equal(device_manager.CommandType.SUBSCRIBE);
      command.parameters.length.should.equal(1);
      command.parameters[0].tag.should.equal(0x81);
      command.parameters[0].value.should.deep.equal(new Buffer([0xA2, 0xA1, 0xA4]));
      command.callback.should.equals(cb);
    });
  });
  
  describe('#createUnsubscribeCommand', function() {    
    it('should return a DeviceCommand for UNSUBSCRIBE', function() {
			var dm = new DeviceManager({});
      var cb = function() {};
      var command = dm.createUnsubscribeCommand(mockDevice, [0xA2, 0xFF01, 0xA1, 0xA4], cb);
      command.should.be.instanceof(device_manager.DeviceCommand);
      command.device.should.equal(mockDevice);
      command.type.should.equal(device_manager.CommandType.UNSUBSCRIBE);
      command.parameters.length.should.equal(1);
      command.parameters[0].tag.should.equal(0x81);
      command.parameters[0].value.should.deep.equal(new Buffer([0xA2, 0xFF, 0x01, 0xA1, 0xA4]));
      command.callback.should.equals(cb);
    });
  });
  
  describe('#createPacket', function() {    
    it('should create a TLV packet with all given commands', function() {
			var dm = new DeviceManager({});
      var cb = function() {};
      var commands = [ dm.createGetDeviceInfoCommand(mockDevice, cb), dm.createGetDeviceInfoCommand(subMockDevice, cb), dm.createGetDataCommand(subMockDevice, [ new TLV(0x82, new Buffer([0xBA, 0xBA])) ], cb) ];
      var tlvPacket = dm.createPacket(commands);
      tlvPacket.tag.should.equal(0xE0);
      tlvPacket.value.length.should.equal(3);
      tlvPacket.value[0].tag.should.equal(0xA0);
      tlvPacket.value[0].value.length.should.equal(0);
      tlvPacket.value[1].tag.should.equal(0xA0);
      tlvPacket.value[1].value.length.should.equal(1);
      tlvPacket.value[1].value[0].tag.should.equal(0x80);
      tlvPacket.value[1].value[0].value.should.deep.equal(new Buffer([0x00]));
      tlvPacket.value[2].tag.should.equal(0xA2);
      tlvPacket.value[2].value.length.should.equal(2);
      tlvPacket.value[2].value[0].tag.should.equal(0x80);
      tlvPacket.value[2].value[0].value.should.deep.equal(new Buffer([0x00]));
      tlvPacket.value[2].value[1].tag.should.equal(0xA0);
    });
  });
  
  describe('#groupCommandsByPhysicalDevice', function() {    
    it('should group commands by the physical device to which they should be sent', function() {
			var dm = new DeviceManager({});
      var cb = function() {};
      var commands = [ dm.createGetDeviceInfoCommand(mockDevice, cb), dm.createGetDeviceInfoCommand(subMockDevice, cb), dm.createGetDeviceInfoCommand(secondMockDevice, cb) ];
      var sortedCommands = device_manager.groupCommandsByPhysicalDevice(commands);
      sortedCommands.get(mockDevice).length.should.equal(2);
      sortedCommands.get(secondMockDevice).length.should.equal(1);
    });
  });
  
  describe('#discoverDevices', function() {    
    it('should discover devices on available connectors', function(done) {
			var dm = new DeviceManager({});
      dm._connectorLoader.loadedModules['mock'] = mock_connector;
      var deviceCount = 3;
      dm.discoverDevices(function(device) {
        deviceCount--;
        
        if (!deviceCount) {
          done();          
        }
      });
    });
  });
});
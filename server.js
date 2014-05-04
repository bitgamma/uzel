var path = require('path');
var DeviceManager = require('./lib/device_manager').DeviceManager;
var ApplianceManager = require('./lib/appliance_manager').ApplianceManager;

// Substitute with a real configuration object
var config = {
  connectorDirectories: [ path.join(__dirname, "plugins/connectors") ],
  applianceDirectories: [ path.join(__dirname, "plugins/appliances") ],
  persistencyPath: __dirname
};

var deviceManager = new DeviceManager(config);

deviceManager.start(function() {
  var applicationManager = new ApplianceManager(config, deviceManager);
  applicationManager.start();
});


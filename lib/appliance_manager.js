var express = require('express');
var PluginLoader = require('plugin-loader').PluginLoader;

exports.ApplianceManager = function(config, deviceManager) {
  Object.defineProperty(this, 'deviceManager', { value: deviceManager });
  this._applianceLoader = new PluginLoader(config.applianceDirectories);
  this._app = express();
}

exports.ApplianceManager.prototype.start = function() {
  // define default routes
  this._app.get('/', index.bind(this));
  
  this._applianceLoader.on('pluginLoaded', initializeAppliance.bind(this));
  this._applianceLoader.on('pluginUnloaded', destroyAppliance.bind(this));
  this._applianceLoader.startMonitoring();
  
  this._app.listen(8000);
}

function initializeAppliance(applianceName, appliance) {
  console.log("Loading appliance: " + applianceName);
  var instance = appliance.createAppliance(this);
  this._app.use('/' + applianceName, instance);
}

function destroyAppliance(applianceName, appliance) {
  console.log("Unloading appliance: " + applianceName);
  // handle deactivating applications
}

function index(req, res) {
  // replace with a real page
  for (var moduleName in this._applianceLoader.loadedModules) {
    res.send('<a href="/' + moduleName + '">' + moduleName + "</a>");
  }  
}

var express = require('express');
var PluginLoader = require('plugin-loader').PluginLoader;

exports.ApplianceManager = function(config, deviceManager) {
  Object.defineProperty(this, 'deviceManager', { value: deviceManager });
  this._applianceLoader = new PluginLoader(config.applianceDirectories);
  this._app = express();
}

exports.ApplianceManager.prototype.start = function() {
  this._app.use(express.static(__dirname + '/../public'));
  this._app.set('views', __dirname + '/../views');
  
  // define default routes
  this._app.get('/', handleIndex.bind(this));
  this._app.get('/dm', handleDeviceManager.bind(this));
  
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

function idToLabel(id) {
  return id.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
}

function handleIndex(req, res) {
  var moduleDescriptors = [];
  
  for (var moduleName in this._applianceLoader.loadedModules) {
    moduleDescriptors.push({ url: '/' + moduleName, icon: '/' + moduleName + '/icon.svg', label: idToLabel(moduleName)});
  }

  moduleDescriptors.push({ url: '/dm', icon: '/img/device_manager.svg', label: 'Device Manager'});
  moduleDescriptors.push({ url: '/settings', icon: '/img/settings.svg', label: 'Settings'});
      
  res.render('index.jade', { appliances: moduleDescriptors });
}

function handleDeviceManager(req, res) {
  res.render('device_manager.jade', {});  
}

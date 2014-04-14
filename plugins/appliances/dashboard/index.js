var express = require('express');
var app;
var appMgr;
var devMgr;

var monitoredDevices = [ { "name": "Foo Thermometer", "value": "20 C" }];

exports.createAppliance = function(applianceManager) {
  if (!app) {
    app = express();
    app.use(express.static(__dirname + '/public'));
    app.set('views', __dirname + '/views');
    
    appMgr = applianceManager;
    devMgr = appMgr.deviceManager;
    app.get('/', index);
    appMgr.io.of('/dashboard').on('connection', handleDashboardSocketConnection);
    
  }
  
  return app;
}

function index(req, res) {
  res.render('index.jade', { });
}

function handleDashboardSocketConnection(socket) {
  socket.emit('init', monitoredDevices);
}
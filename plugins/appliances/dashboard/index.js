var express = require('express');
var app;
var appMgr;
var devMgr;

var units = ["Kelvin", "Celsius", "Fahrenhet"];

exports.createAppliance = function(applianceManager) {
  if (!app) {
    app = express();
    app.use(express.static(__dirname + '/public'));
    app.set('views', __dirname + '/views');
    
    appMgr = applianceManager;
    devMgr = appMgr.deviceManager;
    app.get('/', index);
  }
  
  return app;
}

function index(req, res) {
  res.render('index.jade', { });
}
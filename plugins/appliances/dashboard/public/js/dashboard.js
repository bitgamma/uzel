var dashboard = angular.module('dashboard', [
  'btford.socket-io',
  'ngAnimate',
]).factory('dashboardSocket', function (socketFactory) {
  var dashboardIOSocket = io.connect('/dashboard');

  dashboardSocket = socketFactory({
    ioSocket: dashboardIOSocket
  });

  return dashboardSocket;
});
 
dashboard.controller('DashboardController', function ($scope, $http, dashboardSocket) {     
  $scope.deviceTypes = [];

  $scope.resetAddForm = function() {
    $scope.deviceType = null;
  
    $scope.availableDevices = [];
    $scope.deviceToAdd = null;  
    $scope.addingDevice = false;  
  }
  
  $scope.selectDeviceType = function() {
    if ($scope.deviceType) {
      $http.get('/dashboard/getDevicesByType', { params: { types: $scope.deviceType.value } }).success(function(data) {
        $scope.availableDevices = data;
      });      
    }
  };
  
  $scope.addDevice = function() {
    if ($scope.deviceToAdd) {
      dashboardSocket.emit('addMonitoredDevice', $scope.deviceToAdd.id);
      $scope.resetAddForm();
    }
  };
  
  $scope.removeDevice = function(device) {
    dashboardSocket.emit('removeDevice', device.id);
  };
  
  $scope.updateDevice = function(device) {
    dashboardSocket.emit('updateDevice', device.id);
  };
     
  dashboardSocket.on('init', function(monitoredDevices) {
    $scope.monitoredDevices = monitoredDevices;
    
    for(var i = 0, len = $scope.monitoredDevices.length; i++) {
      $scope.updateDevice($scope.monitoredDevices[i]);
    }
  });
  
  dashboardSocket.on('deviceAdded', function(device) {
    $scope.monitoredDevices.push(device); 
  });
  
  dashboardSocket.on('deviceRemoved', function(deviceID) {
    $scope.monitoredDevices = $scope.monitoredDevices.filter(function(dev) { 
      return dev.id != deviceID;
    });
  });
  
  dashboardSocket.on('deviceUpdated', function(deviceID, value) {
    var updatedDevice = $scope.monitoredDevices.find(function(dev) { 
      return dev.id == deviceID;
    });
    
    updatedDevice.value = value;
  });
  
  $scope.resetAddForm();
  
  $http.get('/dashboard/getSupportedTypes').success(function(data) {
    $scope.deviceTypes = data;
  });
});
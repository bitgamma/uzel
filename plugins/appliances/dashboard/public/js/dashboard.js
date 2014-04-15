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
  
  $scope.resetAddForm();
   
  dashboardSocket.on('init', function(monitoredDevices) {
    $scope.monitoredDevices = monitoredDevices; 
  });
  
  dashboardSocket.on('addedDevice', function(device) {
    $scope.monitoredDevices.push(device); 
  });
  
  $http.get('/dashboard/getSupportedTypes').success(function(data) {
    $scope.deviceTypes = data;
  });
  
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
});
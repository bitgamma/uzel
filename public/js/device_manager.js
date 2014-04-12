var deviceManager = angular.module('deviceManager', [
  'btford.socket-io'
]).factory('deviceSocket', function (socketFactory) {
  var deviceIOSocket = io.connect('/devices');

  deviceSocket = socketFactory({
    ioSocket: deviceIOSocket
  });

  return deviceSocket;
});
 
deviceManager.controller('DeviceController', function ($scope, deviceSocket) {  
  $scope.discoverDevices = function() {
    deviceSocket.emit('discoverDevices');
  }
  
  deviceSocket.on('init', function(data) {
    $scope.pairedDevices = data.pairedDevices; 
    $scope.unpairedDevices = data.unpairedDevices; 
  });
  
  deviceSocket.on('deviceDiscovered', function(device) {
    $scope.unpairedDevices.push(device);
  });
});
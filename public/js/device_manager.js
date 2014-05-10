var deviceManager = angular.module('deviceManager', [
  'btford.socket-io', 'ui.bootstrap'
]).factory('deviceSocket', function (socketFactory) {
  var deviceIOSocket = io.connect('/devices');

  deviceSocket = socketFactory({
    ioSocket: deviceIOSocket
  });

  return deviceSocket;
});
 
deviceManager.controller('DeviceController', function ($scope, deviceSocket, $modal) {  
  $scope.discoverDevices = function() {
    $scope.unpairedDevices = [];
    deviceSocket.emit('discoverDevices');
  }
  
  $scope.pairDevice = function(device) {
    var modalInstance = $modal.open({
      templateUrl: 'getPairingData.html',
      controller: ModalInstanceCtrl,
    });
    
    modalInstance.result.then(function (pairingData) {
      deviceSocket.emit('pairDevice', device, pairingData);
    });
  }
  
  
  $scope.unpairDevice = function(device) {
    deviceSocket.emit('unpairDevice', device);
  }
  
  deviceSocket.on('init', function(data) {
    $scope.pairedDevices = data.pairedDevices; 
    $scope.unpairedDevices = data.unpairedDevices; 
  });
  
  deviceSocket.on('deviceDiscovered', function(device) {
    $scope.unpairedDevices.push(device);
  });
  
  deviceSocket.on('devicePaired', function(device) {
    $scope.pairedDevices.push(device);
    $scope.unpairedDevices = $scope.unpairedDevices.filter(function(dev) { dev.id != device.id });
  });
  
  deviceSocket.on('deviceUnpaired', function(device) {
    $scope.unpairedDevices.push(device);
    $scope.pairedDevices = $scope.pairedDevices.filter(function(dev) { dev.id != device.id });
  });
});

var ModalInstanceCtrl = function ($scope, $modalInstance) {
  $scope.pairingData = null;
  
  $scope.ok = function () {
    $modalInstance.close($scope.pairingData);
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};
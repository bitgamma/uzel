var dashboard = angular.module('dashboard', [
  'btford.socket-io'
]).factory('dashboardSocket', function (socketFactory) {
  var dashboardIOSocket = io.connect('/dashboard');

  dashboardSocket = socketFactory({
    ioSocket: dashboardIOSocket
  });

  return dashboardSocket;
});
 
dashboard.controller('DashboardController', function ($scope, dashboardSocket) { 
  $scope.addingDevice = false;
   
  dashboardSocket.on('init', function(monitoredDevices) {
    $scope.monitoredDevices = monitoredDevices; 
  });
});
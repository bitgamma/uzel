var deviceManager = angular.module('deviceManager', []);
 
deviceManager.controller('DeviceController', function ($scope) {
  $scope.pairedDevices = [
  {
    'name': 'Easy Thermometer',
    'type': 'Temperature Sensor',
    'manufacturer': 'Easy Inc.',
    'icon': '/img/devices/0001.svg',
    'batteryStatus': '56%'
  },
  {
    'name': 'Foo Thermometer',
    'type': 'Temperature Sensor',
    'manufacturer': 'Foo Inc.',
    'icon': '/img/devices/0001.svg',
    'batteryStatus': '96%'
  },
  {
    'name': 'Baa Thermometer',
    'type': 'Temperature Sensor',
    'manufacturer': 'Baa Inc.',
    'icon': '/img/devices/0001.svg',
    'batteryStatus': '0%'
  },
  {
    'name': 'Nal Thermometer',
    'type': 'Temperature Sensor',
    'manufacturer': 'Nal Inc.',
    'icon': '/img/devices/0001.svg',
    'batteryStatus': '70%'
  },
  ];
  
  $scope.unpairedDevices = [
  {
    'name': 'Easy Thermometer',
    'type': 'Temperature Sensor',
    'manufacturer': 'Easy Inc.',
    'icon': '/img/devices/0001.svg',
    'batteryStatus': '66%'
  },
  {
    'name': 'Foo Thermometer',
    'type': 'Temperature Sensor',
    'manufacturer': 'Foo Inc.',
    'icon': '/img/devices/0001.svg',
    'batteryStatus': '45%'
  },
  {
    'name': 'Baa Thermometer',
    'type': 'Temperature Sensor',
    'manufacturer': 'Baa Inc.',
    'icon': '/img/devices/0001.svg',
    'batteryStatus': '10%'
  },
  {
    'name': 'Nal Thermometer',
    'type': 'Temperature Sensor',
    'manufacturer': 'Nal Inc.',
    'icon': '/img/devices/0001.svg',
    'batteryStatus': 'Unknown'
  },
  ];
  
});
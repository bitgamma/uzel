var settings = angular.module('settings', [
  'ngRoute'
]);

settings.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/general', {
        templateUrl: '/settings/_general.html',
        controller: 'GeneralSettingsCtrl'
      }).
      when('/device/:deviceID', {
        templateUrl: 'partials/device-settings.html',
        controller: 'DeviceSettingsCtrl'
      }).
      otherwise({
        redirectTo: '/general'
      });
}]);

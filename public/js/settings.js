var settings = angular.module('settings', [
  'ngRoute', 'colorpicker.module'
]);

settings.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/general', {
        templateUrl: '/partials/settings/general',
        controller: 'GeneralSettingsCtrl'
      }).
      when('/device/:deviceID', {
        templateUrl: '/partials/device-settings.html',
        controller: 'DeviceSettingsCtrl'
      }).
      otherwise({
        redirectTo: '/general'
      });
}]);

settings.controller('GeneralSettingsCtrl', function($scope) {
});



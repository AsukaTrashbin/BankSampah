(function () {
  'use strict';

  var STORAGE_KEY = 'citybinUser';
  var LOGIN_URL = 'login.html';

  function hasSession() {
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY));
    } catch (error) {
      console.error('Gagal membaca data login:', error);
      return false;
    }
  }

  if (!hasSession()) {
    window.location.replace(LOGIN_URL);
  }
})();

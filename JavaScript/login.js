(function () {
  'use strict';

  var STORAGE_KEY = 'citybinUser';
  var USERS_URL = 'users.json';
  var HOME_URL = 'index.html';
  var LOGIN_URL = 'login.html';

  var MSG_REQUIRED = 'Email dan kata sandi wajib diisi.';
  var MSG_INVALID = 'Email atau kata sandi salah.';
  var MSG_LOAD_FAILED = 'Gagal memuat data pengguna. Silakan coba lagi nanti.';

  function clearStoredUser() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Gagal menghapus data login:', error);
    }
  }

  function logout() {
    clearStoredUser();
    window.location.href = LOGIN_URL;
  }

  async function sha256Hex(value) {
    var data = new TextEncoder().encode(value);
    var digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map(function (byte) { return byte.toString(16).padStart(2, '0'); })
      .join('');
  }

  function initPasswordToggle(form) {
    var toggle = document.getElementById('togglePw');
    var password = form.elements.password;
    if (!toggle || !password) {
      return;
    }

    toggle.addEventListener('click', function () {
      var show = password.type === 'password';
      password.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    });
  }

  function initLoginForm(form) {
    var errorBox = document.getElementById('loginError');
    var submitButton = form.querySelector('[type="submit"]');

    function hideError() {
      if (!errorBox) {
        return;
      }
      errorBox.textContent = '';
      errorBox.classList.add('d-none');
    }

    function showError(message) {
      if (!errorBox) {
        return;
      }
      errorBox.textContent = message;
      errorBox.classList.remove('d-none');
    }

    function setBusy(busy) {
      if (!submitButton) {
        return;
      }
      submitButton.disabled = busy;
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      hideError();

      var email = form.elements.email.value.trim();
      var password = form.elements.password.value;
      var remember = form.elements.remember ? form.elements.remember.checked : false;

      if (!email || !password) {
        showError(MSG_REQUIRED);
        return;
      }

      setBusy(true);

      try {
        var response = await fetch(USERS_URL, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Gagal memuat ' + USERS_URL + ' (HTTP ' + response.status + ')');
        }

        var users = await response.json();
        if (!Array.isArray(users)) {
          throw new Error('Format ' + USERS_URL + ' tidak valid: harus berupa array');
        }

        var passwordHash = await sha256Hex(password);
        var emailKey = email.toLowerCase();

        var user = users.find(function (entry) {
          return entry &&
            typeof entry.email === 'string' &&
            typeof entry.passwordHash === 'string' &&
            entry.email.toLowerCase() === emailKey &&
            entry.passwordHash.toLowerCase() === passwordHash;
        });

        if (!user) {
          showError(MSG_INVALID);
          return;
        }

        var session = {
          email: user.email,
          name: user.name,
          loggedInAt: new Date().toISOString()
        };

        clearStoredUser();
        var storage = remember ? localStorage : sessionStorage;
        storage.setItem(STORAGE_KEY, JSON.stringify(session));

        window.location.href = HOME_URL;
      } catch (error) {
        console.error('Login gagal saat memuat atau membaca ' + USERS_URL + ':', error);
        showError(MSG_LOAD_FAILED);
      } finally {
        setBusy(false);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('loginForm');
    if (!form) {
      return;
    }

    initPasswordToggle(form);
    initLoginForm(form);
  });

  window.citybinLogout = logout;
  window.citybin = window.citybin || {};
  window.citybin.logout = logout; 
})();

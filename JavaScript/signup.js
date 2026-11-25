(function () {
  'use strict';

  var USERS_URL = 'users.json';
  var DEMO_USERS_KEY = 'citybinDemoUsers';
  var MIN_PASSWORD_LENGTH = 8;

  function showMessage(message, type) {
    var alert = document.getElementById('signupAlert');
    alert.textContent = message;
    alert.className = 'alert alert-' + type;
  }

  function sha256Hex(value) {
    var data = new TextEncoder().encode(value);
    return crypto.subtle.digest('SHA-256', data).then(function (digest) {
      return Array.from(new Uint8Array(digest))
        .map(function (byte) { return byte.toString(16).padStart(2, '0'); })
        .join('');
    });
  }

  function loadStaticUsers() {
    return fetch(USERS_URL, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) {
        throw new Error('Gagal memuat ' + USERS_URL + ' (HTTP ' + response.status + ')');
      }
      return response.json();
    }).then(function (users) {
      if (!Array.isArray(users)) {
        throw new Error('Format ' + USERS_URL + ' tidak valid');
      }
      return users;
    });
  }

  function readDemoUsers() {
    var users = JSON.parse(localStorage.getItem(DEMO_USERS_KEY) || '[]');
    if (!Array.isArray(users)) {
      throw new Error('Format data pendaftaran tidak valid');
    }
    return users;
  }

  function init() {
    var form = document.getElementById('signupForm');
    if (!form) {
      return;
    }

    var submitButton = form.querySelector('[type="submit"]');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = form.elements.name.value.trim().replace(/\s+/g, ' ');
      var email = form.elements.email.value.trim().toLowerCase();
      var password = form.elements.password.value;
      var confirmPassword = form.elements.confirmPassword.value;

      if (name.length < 2) {
        showMessage('Nama harus terdiri dari minimal 2 karakter.', 'danger');
        form.elements.name.focus();
        return;
      }
      if (!form.elements.email.checkValidity()) {
        showMessage('Masukkan alamat email yang valid.', 'danger');
        form.elements.email.focus();
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        showMessage('Kata sandi harus terdiri dari minimal 8 karakter.', 'danger');
        form.elements.password.focus();
        return;
      }
      if (password !== confirmPassword) {
        showMessage('Konfirmasi kata sandi tidak cocok.', 'danger');
        form.elements.confirmPassword.focus();
        return;
      }
      if (!window.crypto || !window.crypto.subtle) {
        showMessage('Pendaftaran membutuhkan browser modern dan server lokal.', 'danger');
        return;
      }

      submitButton.disabled = true;
      loadStaticUsers().then(function (staticUsers) {
        var demoUsers = readDemoUsers();
        var emailExists = staticUsers.concat(demoUsers).some(function (user) {
          return user && typeof user.email === 'string' && user.email.toLowerCase() === email;
        });
        if (emailExists) {
          throw new Error('EMAIL_EXISTS');
        }
        return sha256Hex(password).then(function (passwordHash) {
          demoUsers.push({
            email: email,
            name: name,
            passwordHash: passwordHash
          });
          localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(demoUsers));
          window.location.href = 'login.html?registered=1';
        });
      }).catch(function (error) {
        if (error.message === 'EMAIL_EXISTS') {
          showMessage('Email sudah terdaftar. Silakan login atau gunakan email lain.', 'danger');
          return;
        }
        console.error('Pendaftaran gagal:', error);
        showMessage('Pendaftaran gagal. Pastikan situs dijalankan melalui server lokal, lalu coba lagi.', 'danger');
      }).then(function () {
        submitButton.disabled = false;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

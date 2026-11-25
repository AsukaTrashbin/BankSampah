import { apiPost, showMessage, hideMessage, setBusy, errorMessage } from './auth-api.js';

const PASSWORD_RULE = 'Password minimal 8 karakter dan harus mengandung huruf serta angka.';

function isValidPassword(password) {
  return password.length >= 8 &&
    password.length <= 128 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password);
}

function initResetForm() {
  const form = document.getElementById('resetForm');
  if (!form) {
    return;
  }

  const alertBox = document.getElementById('resetAlert');
  const submitButton = form.querySelector('[type="submit"]');
  const passwordInput = form.elements.namedItem('password');
  const confirmInput = form.elements.namedItem('confirmPassword');
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    showMessage(alertBox, 'Tautan reset tidak valid atau sudah kedaluwarsa.', 'danger');
    submitButton.disabled = true;
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage(alertBox);

    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (!isValidPassword(password)) {
      showMessage(alertBox, PASSWORD_RULE, 'danger');
      passwordInput.focus();
      return;
    }
    if (password !== confirmPassword) {
      showMessage(alertBox, 'Konfirmasi password tidak cocok.', 'danger');
      confirmInput.focus();
      return;
    }

    setBusy(submitButton, true, 'Menyimpan...');

    try {
      const result = await apiPost('/api/auth/reset', { token, password, confirmPassword });
      if (result.response.ok) {
        window.location.assign(
          result.data && result.data.redirect ? result.data.redirect : '/login.html?reset=1'
        );
        return;
      }

      showMessage(
        alertBox,
        errorMessage(result, 'Tautan reset tidak valid atau sudah kedaluwarsa.'),
        'danger'
      );
      setBusy(submitButton, false);
    } catch (error) {
      console.error('Reset password gagal:', error.message);
      showMessage(alertBox, 'Tidak dapat menghubungi server. Silakan coba lagi.', 'danger');
      setBusy(submitButton, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', initResetForm);

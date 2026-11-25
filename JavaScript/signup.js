import { apiPost, showMessage, setBusy, errorMessage } from './auth-api.js';

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_RULE = 'Password minimal 8 karakter dan harus mengandung huruf serta angka.';

function isValidPassword(password) {
  return password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= 128 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password);
}

function initSignupForm() {
  const form = document.getElementById('signupForm');
  if (!form) {
    return;
  }

  const alertBox = document.getElementById('signupAlert');
  const submitButton = form.querySelector('[type="submit"]');
  const nameInput = form.elements.namedItem('name');
  const emailInput = form.elements.namedItem('email');
  const passwordInput = form.elements.namedItem('password');
  const confirmInput = form.elements.namedItem('confirmPassword');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = nameInput.value.trim().replace(/\s+/g, ' ');
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (!name) {
      showMessage(alertBox, 'Nama wajib diisi.', 'danger');
      nameInput.focus();
      return;
    }
    if (name.length < 2 || name.length > 60) {
      showMessage(alertBox, 'Nama harus terdiri dari 2 sampai 60 karakter.', 'danger');
      nameInput.focus();
      return;
    }
    if (!email || !emailInput.checkValidity()) {
      showMessage(alertBox, 'Masukkan alamat email yang valid.', 'danger');
      emailInput.focus();
      return;
    }
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

    setBusy(submitButton, true, 'Mendaftar...');

    try {
      const result = await apiPost('/api/auth/signup', {
        name,
        email,
        password,
        confirmPassword
      });

      if (result.response.ok) {
        window.location.assign(result.data && result.data.redirect ? result.data.redirect : '/dashboard.html');
        return;
      }

      showMessage(
        alertBox,
        errorMessage(result, 'Pendaftaran gagal. Silakan coba lagi.'),
        'danger'
      );
      setBusy(submitButton, false);
    } catch (error) {
      console.error('Pendaftaran gagal:', error.message);
      showMessage(alertBox, 'Tidak dapat menghubungi server. Silakan coba lagi.', 'danger');
      setBusy(submitButton, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', initSignupForm);

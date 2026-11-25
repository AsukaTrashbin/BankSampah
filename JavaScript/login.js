import { apiPost, showMessage, hideMessage, setBusy, errorMessage } from './auth-api.js';

const MSG_INVALID = 'Email atau password salah';

function initPasswordToggle(form) {
  const toggle = document.getElementById('togglePw');
  const password = form.elements.namedItem('password');
  if (!toggle || !password) {
    return;
  }

  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
  });
}

function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) {
    return;
  }

  const errorBox = document.getElementById('loginError');
  const noticeBox = document.getElementById('loginNotice');
  const submitButton = form.querySelector('[type="submit"]');
  const emailInput = form.elements.namedItem('email');
  const passwordInput = form.elements.namedItem('password');
  const rememberInput = form.elements.namedItem('remember');

  initPasswordToggle(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage(errorBox);
    hideMessage(noticeBox);

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const remember = Boolean(rememberInput && rememberInput.checked);

    if (!email || !password) {
      showMessage(errorBox, email ? 'Password wajib diisi.' : 'Email dan password wajib diisi.', 'danger');
      (email ? passwordInput : emailInput).focus();
      return;
    }

    setBusy(submitButton, true, 'Masuk...');

    try {
      const result = await apiPost('/api/auth/login', { email, password, remember });

      if (result.response.ok) {
        window.location.assign(result.data && result.data.redirect ? result.data.redirect : '/dashboard.html');
        return;
      }

      const message = result.response.status === 429
        ? errorMessage(result, 'Terlalu banyak percobaan. Coba lagi nanti.')
        : MSG_INVALID;
      showMessage(errorBox, message, 'danger');
      passwordInput.value = '';
      passwordInput.focus();
      setBusy(submitButton, false);
    } catch (error) {
      console.error('Login gagal:', error.message);
      showMessage(errorBox, 'Tidak dapat menghubungi server. Silakan coba lagi.', 'danger');
      setBusy(submitButton, false);
    }
  });
}

function showQueryNotice() {
  const notice = document.getElementById('loginNotice');
  if (!notice) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('registered') === '1') {
    showMessage(notice, 'Pendaftaran berhasil. Silakan login.', 'success');
  } else if (params.get('reset') === '1') {
    showMessage(notice, 'Password berhasil diubah. Silakan login dengan password baru.', 'success');
  } else if (params.get('loggedout') === '1') {
    showMessage(notice, 'Anda telah logout.', 'success');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initLoginForm();
  showQueryNotice();
});

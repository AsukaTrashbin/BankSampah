import { apiPost, showMessage, hideMessage, setBusy, errorMessage } from './auth-api.js';

function initForgotForm() {
  const form = document.getElementById('forgotForm');
  if (!form) {
    return;
  }

  const alertBox = document.getElementById('forgotAlert');
  const submitButton = form.querySelector('[type="submit"]');
  const emailInput = form.elements.namedItem('email');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage(alertBox);

    const email = emailInput.value.trim();
    if (!email || !emailInput.checkValidity()) {
      showMessage(alertBox, 'Masukkan alamat email yang valid.', 'danger');
      emailInput.focus();
      return;
    }

    setBusy(submitButton, true, 'Mengirim...');

    try {
      const result = await apiPost('/api/auth/forgot', { email });
      if (result.response.ok) {
        showMessage(
          alertBox,
          (result.data && result.data.message) ||
            'Jika email terdaftar, kami telah mengirim tautan reset password.',
          'success'
        );
        form.reset();
      } else {
        showMessage(
          alertBox,
          errorMessage(result, 'Permintaan tidak dapat diproses. Silakan coba lagi.'),
          'danger'
        );
      }
    } catch (error) {
      console.error('Permintaan reset gagal:', error.message);
      showMessage(alertBox, 'Tidak dapat menghubungi server. Silakan coba lagi.', 'danger');
    } finally {
      setBusy(submitButton, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', initForgotForm);

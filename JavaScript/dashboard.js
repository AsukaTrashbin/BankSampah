import { requireSession } from './auth-guard.js';
import { apiPost, showMessage, setBusy } from './auth-api.js';

function renderUser(user) {
  const nameEl = document.getElementById('userName');
  const emailEl = document.getElementById('userEmail');
  const createdEl = document.getElementById('userCreatedAt');

  if (nameEl) {
    nameEl.textContent = user.name;
  }
  if (emailEl) {
    emailEl.textContent = user.email;
  }
  if (createdEl && user.createdAt) {
    const date = new Date(user.createdAt);
    createdEl.textContent = Number.isNaN(date.getTime())
      ? user.createdAt
      : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

function initLogout(user) {
  const button = document.getElementById('logoutBtn');
  const alertBox = document.getElementById('dashboardAlert');
  if (!button) {
    return;
  }

  button.addEventListener('click', async () => {
    setBusy(button, true, 'Keluar...');
    try {
      const result = await apiPost('/api/auth/logout', {});
      if (result.response.ok) {
        window.location.assign('/login.html?loggedout=1');
        return;
      }
      showMessage(alertBox, 'Logout gagal. Silakan coba lagi.', 'danger');
      setBusy(button, false);
    } catch (error) {
      console.error('Logout gagal:', error.message);
      showMessage(alertBox, 'Tidak dapat menghubungi server. Silakan coba lagi.', 'danger');
      setBusy(button, false);
    }
  });

  renderUser(user);
}

document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('dashboardAlert');

  try {
    const user = await requireSession();
    if (!user) {
      return;
    }
    initLogout(user);
  } catch (error) {
    console.error('Gagal memuat sesi:', error.message);
    showMessage(alertBox, 'Tidak dapat memuat data akun. Muat ulang halaman.', 'danger');
  }
});

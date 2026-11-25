import { apiGet } from './auth-api.js';

export async function requireSession() {
  const { response, data } = await apiGet('/api/auth/me');

  if (response.status === 401) {
    const next = encodeURIComponent(window.location.pathname);
    window.location.replace(`/login.html?next=${next}`);
    return null;
  }

  if (!response.ok) {
    throw new Error('Sesi tidak dapat diperiksa.');
  }

  return data && data.user ? data.user : null;
}

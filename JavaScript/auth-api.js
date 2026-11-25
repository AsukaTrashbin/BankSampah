let csrfToken = null;
let csrfRequest = null;

async function requestJson(path, options) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  return { response, data };
}

export async function getCsrfToken(forceRefresh) {
  if (csrfToken && !forceRefresh) {
    return csrfToken;
  }

  if (!csrfRequest) {
    csrfRequest = requestJson('/api/auth/csrf', { method: 'GET' })
      .then(({ response, data }) => {
        if (!response.ok || !data || typeof data.csrfToken !== 'string') {
          throw new Error('Tidak dapat menyiapkan keamanan formulir.');
        }
        csrfToken = data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }

  return csrfRequest;
}

export function apiGet(path) {
  return requestJson(path, { method: 'GET' });
}

export async function apiPost(path, body) {
  const send = async (token) => requestJson(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token
    },
    body: JSON.stringify(body || {})
  });

  let token = await getCsrfToken();
  let result = await send(token);

  if (result.response.status === 403) {
    token = await getCsrfToken(true);
    result = await send(token);
  }

  return result;
}

export function showMessage(element, message, type) {
  if (!element) {
    return;
  }
  const variant = type === 'success' ? 'success' : (type === 'warning' ? 'warning' : 'danger');
  element.textContent = message;
  element.classList.remove('d-none', 'alert-danger', 'alert-success', 'alert-warning', 'alert-info');
  element.classList.add(`alert-${variant}`);
}

export function hideMessage(element) {
  if (!element) {
    return;
  }
  element.textContent = '';
  element.classList.add('d-none');
}

export function setBusy(button, busy, busyLabel) {
  if (!button) {
    return;
  }

  if (busy) {
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent;
    }
    button.disabled = true;
    button.textContent = busyLabel || 'Memproses...';
    return;
  }

  button.disabled = false;
  if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
}

export function errorMessage(result, fallback) {
  if (result && result.data && typeof result.data.error === 'string') {
    return result.data.error;
  }
  return fallback;
}

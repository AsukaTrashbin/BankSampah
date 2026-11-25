'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { createApp } = require('../server/app');

const VALID_USER = {
  name: 'Budi Santoso',
  email: 'budi@example.com',
  password: 'rahasia123',
  confirmPassword: 'rahasia123'
};

function createClient(baseUrl) {
  const cookies = new Map();

  async function request(pathname, options) {
    const opts = options || {};
    const headers = { ...(opts.headers || {}) };
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (cookies.size > 0) {
      headers.cookie = [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
    }

    const response = await fetch(`${baseUrl}${pathname}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      redirect: 'manual'
    });

    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];
    for (const rawCookie of setCookies) {
      const pair = rawCookie.split(';')[0];
      const separator = pair.indexOf('=');
      if (separator < 0) {
        continue;
      }
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (!value || /max-age=0/i.test(rawCookie)) {
        cookies.delete(name);
      } else {
        cookies.set(name, value);
      }
    }

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = text;
      }
    }

    return { response, status: response.status, data };
  }

  async function csrf() {
    const result = await request('/api/auth/csrf');
    return result.data.csrfToken;
  }

  async function post(pathname, body) {
    const token = await csrf();
    return request(pathname, {
      method: 'POST',
      headers: { 'x-csrf-token': token },
      body: body || {}
    });
  }

  return {
    request,
    get: (pathname) => request(pathname),
    post,
    csrf,
    cookies
  };
}

async function startTestApp(overrides) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'citybin-test-'));
  const usersFile = path.join(directory, 'users.json');
  const sentEmails = [];
  const mailer = {
    enabled: true,
    async sendResetEmail(payload) {
      sentEmails.push(payload);
    }
  };

  const created = await createApp({
    config: {
      usersFile,
      nodeEnv: 'test',
      sessionSecret: 'test-session-secret-0123456789abcdef',
      baseUrl: 'http://127.0.0.1',
      bcryptRounds: 4,
      secureCookies: false,
      logResetLinks: false,
      loginRateLimitMax: 1000,
      forgotRateLimitMax: 1000,
      ...(overrides || {})
    },
    mailer
  });

  const server = created.app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    ...created,
    baseUrl,
    directory,
    usersFile,
    sentEmails,
    client: createClient(baseUrl),
    close: () => new Promise((resolve) => server.close(resolve)),
    cleanup: async () => {
      await new Promise((resolve) => server.close(resolve));
      await fs.rm(directory, { recursive: true, force: true });
    }
  };
}

async function readUsers(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

test('signup sukses menyimpan user, hash bcrypt, dan membuat sesi', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  const result = await ctx.client.post('/api/auth/signup', {
    ...VALID_USER,
    name: '  Budi   Santoso ',
    email: '  BUDI@Example.COM '
  });

  assert.equal(result.status, 201);
  assert.equal(result.data.user.email, 'budi@example.com');
  assert.equal(result.data.user.name, 'Budi Santoso');
  assert.equal(result.data.redirect, '/dashboard.html');
  assert.ok(ctx.client.cookies.has('citybin.sid'));
  const setCookie = result.response.headers.getSetCookie().join(';');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);

  const users = await readUsers(ctx.usersFile);
  assert.equal(users.length, 1);
  const user = users[0];
  assert.match(user.id, /^[0-9a-f-]{36}$/i);
  assert.notEqual(user.passwordHash, VALID_USER.password);
  assert.match(user.passwordHash, /^\$2[aby]\$/);
  assert.equal(await bcrypt.compare(VALID_USER.password, user.passwordHash), true);
  assert.equal(user.failedLoginCount, 0);
  assert.equal(user.lockedUntil, null);
  assert.equal(Number.isNaN(Date.parse(user.createdAt)), false);
  assert.equal(JSON.stringify(result.data).includes(VALID_USER.password), false);
  assert.equal(JSON.stringify(result.data).includes(user.passwordHash), false);

  const me = await ctx.client.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, 'budi@example.com');
});

test('signup menolak email ganda tanpa membedakan huruf besar/kecil', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  const first = await ctx.client.post('/api/auth/signup', VALID_USER);
  assert.equal(first.status, 201);

  const second = await ctx.client.post('/api/auth/signup', {
    ...VALID_USER,
    name: 'Budi Lain',
    email: 'BUDI@EXAMPLE.COM'
  });
  assert.equal(second.status, 409);
  assert.match(second.data.error, /sudah terdaftar/i);

  const users = await readUsers(ctx.usersFile);
  assert.equal(users.length, 1);
});

test('signup menolak input tidak valid di server', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  const cases = [
    { ...VALID_USER, name: '' },
    { ...VALID_USER, email: 'bukan-email' },
    { ...VALID_USER, password: 'pendek1', confirmPassword: 'pendek1' },
    { ...VALID_USER, password: 'hanyaHuruf', confirmPassword: 'hanyaHuruf' },
    { ...VALID_USER, password: '12345678', confirmPassword: '12345678' },
    { ...VALID_USER, password: '', confirmPassword: '' },
    { ...VALID_USER, confirmPassword: 'berbeda123' }
  ];

  for (const payload of cases) {
    const result = await ctx.client.post('/api/auth/signup', payload);
    assert.equal(result.status, 400, JSON.stringify(payload));
    assert.equal(typeof result.data.error, 'string');
  }

  const users = await readUsers(ctx.usersFile);
  assert.equal(users.length, 0);
});

test('login sukses, sesi bertahan, dan remember me memakai cookie persisten', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  await ctx.client.post('/api/auth/signup', VALID_USER);
  const logout = await ctx.client.post('/api/auth/logout', {});
  assert.equal(logout.status, 200);

  const login = await ctx.client.post('/api/auth/login', {
    email: 'budi@example.com',
    password: 'rahasia123',
    remember: true
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.email, 'budi@example.com');
  assert.match(login.response.headers.getSetCookie().join(';'), /Max-Age=604800/i);

  const firstMe = await ctx.client.get('/api/auth/me');
  const secondMe = await ctx.client.get('/api/auth/me');
  assert.equal(firstMe.status, 200);
  assert.equal(secondMe.status, 200);
  assert.equal(secondMe.data.user.id, firstMe.data.user.id);
});

test('login salah password dan email tidak dikenal memberi pesan identik', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  await ctx.client.post('/api/auth/signup', VALID_USER);
  await ctx.client.post('/api/auth/logout', {});

  const wrongPassword = await ctx.client.post('/api/auth/login', {
    email: 'budi@example.com',
    password: 'salah12345'
  });
  const unknownEmail = await ctx.client.post('/api/auth/login', {
    email: 'tidak.ada@example.com',
    password: 'salah12345'
  });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.data.error, 'Email atau password salah');
  assert.deepEqual(wrongPassword.data, unknownEmail.data);
});

test('akun terkunci 15 menit setelah 5 kali gagal login', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  await ctx.client.post('/api/auth/signup', VALID_USER);
  await ctx.client.post('/api/auth/logout', {});

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const failed = await ctx.client.post('/api/auth/login', {
      email: 'budi@example.com',
      password: 'salah12345'
    });
    assert.equal(failed.status, 401);
    assert.equal(failed.data.error, 'Email atau password salah');
  }

  let users = await readUsers(ctx.usersFile);
  assert.equal(users[0].failedLoginCount, 5);
  assert.ok(Date.parse(users[0].lockedUntil) > Date.now());

  const blocked = await ctx.client.post('/api/auth/login', {
    email: 'budi@example.com',
    password: 'rahasia123'
  });
  assert.equal(blocked.status, 401);
  assert.equal(blocked.data.error, 'Email atau password salah');

  await ctx.store.update((records) => {
    records[0].lockedUntil = new Date(Date.now() - 1000).toISOString();
    records[0].failedLoginCount = 0;
  });

  const unlocked = await ctx.client.post('/api/auth/login', {
    email: 'budi@example.com',
    password: 'rahasia123'
  });
  assert.equal(unlocked.status, 200);

  users = await readUsers(ctx.usersFile);
  assert.equal(users[0].failedLoginCount, 0);
  assert.equal(users[0].lockedUntil, null);
});

test('logout menghapus sesi dan halaman terlindungi menolak akses', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  const anonymousDashboard = await ctx.client.get('/dashboard.html');
  assert.equal(anonymousDashboard.status, 302);
  assert.match(anonymousDashboard.response.headers.get('location'), /\/login\.html\?next=/);

  const anonymousMe = await ctx.client.get('/api/auth/me');
  assert.equal(anonymousMe.status, 401);

  await ctx.client.post('/api/auth/signup', VALID_USER);
  const dashboard = await ctx.client.get('/dashboard.html');
  assert.equal(dashboard.status, 200);
  assert.match(String(dashboard.data), /Dashboard/);

  const logout = await ctx.client.post('/api/auth/logout', {});
  assert.equal(logout.status, 200);
  assert.equal(ctx.client.cookies.has('citybin.sid'), false);

  const meAfter = await ctx.client.get('/api/auth/me');
  assert.equal(meAfter.status, 401);
  const dashboardAfter = await ctx.client.get('/dashboard.html');
  assert.equal(dashboardAfter.status, 302);
});

test('forgot memberi respons sama untuk email terdaftar dan tidak, serta menyimpan hash token', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  await ctx.client.post('/api/auth/signup', VALID_USER);
  await ctx.client.post('/api/auth/logout', {});

  const registered = await ctx.client.post('/api/auth/forgot', { email: 'BUDI@example.com' });
  assert.equal(registered.status, 200);
  assert.equal(registered.data.message, 'Jika email terdaftar, kami telah mengirim tautan reset password.');
  assert.equal(ctx.sentEmails.length, 1);
  assert.equal(JSON.stringify(registered.data).includes('token'), false);

  const resetUrl = new URL(ctx.sentEmails[0].resetUrl);
  const rawToken = resetUrl.searchParams.get('token');
  assert.ok(rawToken && rawToken.length >= 43);

  const users = await readUsers(ctx.usersFile);
  const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  assert.equal(users[0].resetTokenHash, expectedHash);
  assert.notEqual(users[0].resetTokenHash, rawToken);
  assert.equal(users[0].resetTokenUsed, false);
  const ttl = Date.parse(users[0].resetTokenExpiresAt) - Date.now();
  assert.ok(ttl > 25 * 60 * 1000 && ttl <= 30 * 60 * 1000);

  const otherClient = createClient(ctx.baseUrl);
  const unknown = await otherClient.post('/api/auth/forgot', { email: 'unknown@example.com' });
  const invalid = await otherClient.post('/api/auth/forgot', { email: 'bukan-email' });
  assert.equal(unknown.status, 200);
  assert.equal(invalid.status, 200);
  assert.deepEqual(unknown.data, registered.data);
  assert.deepEqual(invalid.data, registered.data);
  assert.equal(ctx.sentEmails.length, 1);
});

test('reset password berhasil sekali, menghapus sesi lain, dan menolak pemakaian ulang', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  const authClient = ctx.client;
  await authClient.post('/api/auth/signup', VALID_USER);

  const resetClient = createClient(ctx.baseUrl);
  await resetClient.post('/api/auth/forgot', { email: 'budi@example.com' });
  const token = new URL(ctx.sentEmails[0].resetUrl).searchParams.get('token');

  assert.equal((await authClient.get('/api/auth/me')).status, 200);

  const reset = await resetClient.post('/api/auth/reset', {
    token,
    password: 'passwordBaru9',
    confirmPassword: 'passwordBaru9'
  });
  assert.equal(reset.status, 200);
  assert.equal(reset.data.redirect, '/login.html?reset=1');

  assert.equal((await authClient.get('/api/auth/me')).status, 401);

  const loginOld = await resetClient.post('/api/auth/login', {
    email: 'budi@example.com',
    password: 'rahasia123'
  });
  assert.equal(loginOld.status, 401);

  const loginNew = await resetClient.post('/api/auth/login', {
    email: 'budi@example.com',
    password: 'passwordBaru9'
  });
  assert.equal(loginNew.status, 200);

  const reuse = await resetClient.post('/api/auth/reset', {
    token,
    password: 'passwordLain7',
    confirmPassword: 'passwordLain7'
  });
  assert.equal(reuse.status, 400);
  assert.equal(reuse.data.error, 'Tautan reset tidak valid atau sudah kedaluwarsa.');

  const users = await readUsers(ctx.usersFile);
  assert.equal(users[0].resetTokenUsed, true);
  assert.equal(await bcrypt.compare('passwordBaru9', users[0].passwordHash), true);
  assert.equal(await bcrypt.compare('passwordLain7', users[0].passwordHash), false);
});

test('reset menolak token kedaluwarsa dan token acak', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  await ctx.client.post('/api/auth/signup', VALID_USER);

  const resetClient = createClient(ctx.baseUrl);
  await resetClient.post('/api/auth/forgot', { email: 'budi@example.com' });
  const token = new URL(ctx.sentEmails[0].resetUrl).searchParams.get('token');

  await ctx.store.update((users) => {
    users[0].resetTokenExpiresAt = new Date(Date.now() - 60 * 1000).toISOString();
  });

  const expired = await resetClient.post('/api/auth/reset', {
    token,
    password: 'passwordBaru9',
    confirmPassword: 'passwordBaru9'
  });
  assert.equal(expired.status, 400);
  assert.equal(expired.data.error, 'Tautan reset tidak valid atau sudah kedaluwarsa.');

  const random = await resetClient.post('/api/auth/reset', {
    token: 'token-acak-yang-tidak-ada',
    password: 'passwordBaru9',
    confirmPassword: 'passwordBaru9'
  });
  assert.equal(random.status, 400);
  assert.equal(random.data.error, 'Tautan reset tidak valid atau sudah kedaluwarsa.');
});

test('penulisan bersamaan tidak merusak file JSON', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  const signups = Array.from({ length: 20 }, (_, index) => {
    const client = createClient(ctx.baseUrl);
    return client.post('/api/auth/signup', {
      name: `Warga ${index + 1}`,
      email: `warga${index + 1}@example.com`,
      password: 'rahasia123',
      confirmPassword: 'rahasia123'
    });
  });

  const results = await Promise.all(signups);
  assert.equal(results.every((result) => result.status === 201), true);

  const users = await readUsers(ctx.usersFile);
  assert.equal(users.length, 20);
  assert.equal(new Set(users.map((user) => user.id)).size, 20);
  assert.equal(new Set(users.map((user) => user.email)).size, 20);
  for (const user of users) {
    assert.equal(await bcrypt.compare('rahasia123', user.passwordHash), true);
  }
});

test('POST tanpa token CSRF ditolak', async (t) => {
  const ctx = await startTestApp();
  t.after(() => ctx.cleanup());

  const noToken = await ctx.client.request('/api/auth/signup', {
    method: 'POST',
    body: VALID_USER
  });
  assert.equal(noToken.status, 403);

  await ctx.client.get('/api/auth/csrf');
  const wrongToken = await ctx.client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'x-csrf-token': 'token-palsu' },
    body: VALID_USER
  });
  assert.equal(wrongToken.status, 403);

  const users = await readUsers(ctx.usersFile);
  assert.equal(users.length, 0);
});

test('rate limit login mengembalikan 429 setelah batas tercapai', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'citybin-rate-'));
  const ctx = await startTestApp({
    usersFile: path.join(directory, 'users.json'),
    loginRateLimitMax: 3
  });
  t.after(async () => {
    await ctx.cleanup();
    await fs.rm(directory, { recursive: true, force: true });
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const failed = await ctx.client.post('/api/auth/login', {
      email: 'nobody@example.com',
      password: 'salah12345'
    });
    assert.equal(failed.status, 401);
  }

  const limited = await ctx.client.post('/api/auth/login', {
    email: 'nobody@example.com',
    password: 'salah12345'
  });
  assert.equal(limited.status, 429);
});

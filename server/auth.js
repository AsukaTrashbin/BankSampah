'use strict';

const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const { csrfProtection, createRateLimiters } = require('./security');
const { baseCookieOptions } = require('./sessions');

const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const MSG_INVALID_CREDENTIALS = 'Email atau password salah';
const MSG_FORGOT = 'Jika email terdaftar, kami telah mengirim tautan reset password.';
const MSG_RESET_INVALID = 'Tautan reset tidak valid atau sudah kedaluwarsa.';
const MSG_PASSWORD_RULE = 'Password minimal 8 karakter dan harus mengandung huruf serta angka.';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value === undefined || value === null ? '' : value).trim().toLowerCase();
}

function normalizeName(value) {
  return String(value === undefined || value === null ? '' : value).trim().replace(/\s+/g, ' ');
}

function isValidEmail(email) {
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email);
}

function isValidPassword(password) {
  return typeof password === 'string' &&
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createAuthRouter({ config, store, sessionStore, mailer }) {
  const router = express.Router();
  const { loginLimiter, forgotLimiter } = createRateLimiters(config);
  const dummyHashPromise = bcrypt.hash(
    crypto.randomBytes(16).toString('hex'),
    config.bcryptRounds
  );

  router.use(csrfProtection());

  router.get('/csrf', (req, res) => {
    let session = req.session;
    if (!session) {
      session = sessionStore.create(null, config.anonymousTtlMs);
      res.cookie(
        sessionStore.cookieName,
        sessionStore.cookieValue(session.id),
        { ...baseCookieOptions(config), maxAge: config.anonymousTtlMs }
      );
    }
    res.set('Cache-Control', 'no-store');
    return res.json({ csrfToken: session.csrfToken });
  });

  router.post('/signup', async (req, res) => {
    const body = req.body || {};
    const name = normalizeName(body.name);
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword = body.confirmPassword;

    if (!name) {
      return res.status(400).json({ error: 'Nama wajib diisi.' });
    }
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ error: 'Nama harus terdiri dari 2 sampai 60 karakter.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Masukkan alamat email yang valid.' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: MSG_PASSWORD_RULE });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'Konfirmasi password tidak cocok.' });
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const now = new Date().toISOString();
    const newUser = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash,
      createdAt: now,
      failedLoginCount: 0,
      lockedUntil: null,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      resetTokenUsed: false
    };

    try {
      await store.update((users) => {
        if (users.some((user) => user.email === email)) {
          const duplicate = new Error('EMAIL_EXISTS');
          duplicate.code = 'EMAIL_EXISTS';
          throw duplicate;
        }
        users.push(newUser);
      });
    } catch (error) {
      if (error.code === 'EMAIL_EXISTS') {
        return res.status(409).json({ error: 'Email sudah terdaftar. Silakan login atau gunakan email lain.' });
      }
      throw error;
    }

    const session = sessionStore.rotate(req.session, newUser.id, config.sessionTtlMs);
    res.cookie(
      sessionStore.cookieName,
      sessionStore.cookieValue(session.id),
      baseCookieOptions(config)
    );

    return res.status(201).json({
      message: 'Pendaftaran berhasil.',
      user: publicUser(newUser),
      redirect: '/dashboard.html'
    });
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const remember = body.remember === true;
    const now = Date.now();

    if (!email || !password) {
      return res.status(401).json({ error: MSG_INVALID_CREDENTIALS });
    }

    const user = isValidEmail(email) ? await store.findByEmail(email) : null;

    if (!user) {
      // Keep unknown-email and wrong-password responses close in timing.
      await bcrypt.compare(password, await dummyHashPromise).catch(() => false);
      return res.status(401).json({ error: MSG_INVALID_CREDENTIALS });
    }

    const lockedUntil = user.lockedUntil ? Date.parse(user.lockedUntil) : 0;
    if (lockedUntil && lockedUntil > now) {
      return res.status(401).json({ error: MSG_INVALID_CREDENTIALS });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash).catch(() => false);
    if (!passwordMatches) {
      await store.update((users) => {
        const target = users.find((entry) => entry.id === user.id);
        if (!target) {
          return;
        }
        target.failedLoginCount = Number(target.failedLoginCount || 0) + 1;
        if (target.failedLoginCount >= MAX_FAILED_LOGINS) {
          target.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
        }
      });
      return res.status(401).json({ error: MSG_INVALID_CREDENTIALS });
    }

    const updatedUser = await store.update((users) => {
      const target = users.find((entry) => entry.id === user.id);
      if (!target) {
        return null;
      }
      target.failedLoginCount = 0;
      target.lockedUntil = null;
      return { ...target };
    });

    if (!updatedUser) {
      return res.status(401).json({ error: MSG_INVALID_CREDENTIALS });
    }

    const ttl = remember ? config.rememberTtlMs : config.sessionTtlMs;
    const session = sessionStore.rotate(req.session, updatedUser.id, ttl);
    const cookieOptions = baseCookieOptions(config);
    if (remember) {
      cookieOptions.maxAge = config.rememberTtlMs;
    }
    res.cookie(sessionStore.cookieName, sessionStore.cookieValue(session.id), cookieOptions);

    return res.json({
      message: 'Login berhasil.',
      user: publicUser(updatedUser),
      redirect: '/dashboard.html'
    });
  });

  router.post('/logout', (req, res) => {
    sessionStore.destroy(req.session);
    res.clearCookie(sessionStore.cookieName, baseCookieOptions(config));
    return res.json({ message: 'Anda telah logout.' });
  });

  router.get('/me', async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Tidak terautentikasi.' });
    }

    const user = await store.findById(req.session.userId);
    if (!user) {
      sessionStore.destroy(req.session);
      res.clearCookie(sessionStore.cookieName, baseCookieOptions(config));
      return res.status(401).json({ error: 'Tidak terautentikasi.' });
    }

    return res.json({ user: publicUser(user) });
  });

  router.post('/forgot', forgotLimiter, async (req, res) => {
    const email = normalizeEmail((req.body || {}).email);

    try {
      if (isValidEmail(email)) {
        const token = crypto.randomBytes(32).toString('base64url');
        const tokenHash = sha256(token);
        const expiresAt = new Date(Date.now() + config.resetTokenTtlMs).toISOString();

        const user = await store.update((users) => {
          const target = users.find((entry) => entry.email === email);
          if (!target) {
            return null;
          }
          target.resetTokenHash = tokenHash;
          target.resetTokenExpiresAt = expiresAt;
          target.resetTokenUsed = false;
          return { ...target };
        });

        if (user) {
          const resetUrl = `${config.baseUrl}/reset-password.html?token=${encodeURIComponent(token)}`;
          if (mailer.enabled) {
            try {
              await mailer.sendResetEmail({ to: user.email, name: user.name, resetUrl });
            } catch (error) {
              console.error('[auth] Gagal mengirim email reset:', error.message);
            }
          } else if (config.logResetLinks) {
            // Explicitly allowed for development only; never enabled in production.
            console.log(`[auth] Link reset password untuk ${user.email}: ${resetUrl}`);
          } else {
            console.warn('[auth] SMTP belum dikonfigurasi; email reset tidak dikirim.');
          }
        }
      }
    } catch (error) {
      // The public response must stay identical for every email.
      console.error('[auth] Gagal memproses permintaan reset:', error.message);
    }

    return res.json({ message: MSG_FORGOT });
  });

  router.post('/reset', async (req, res) => {
    const body = req.body || {};
    const token = typeof body.token === 'string' ? body.token : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword = body.confirmPassword;

    if (!token) {
      return res.status(400).json({ error: MSG_RESET_INVALID });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: MSG_PASSWORD_RULE });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'Konfirmasi password tidak cocok.' });
    }

    const tokenHash = sha256(token);
    const newPasswordHash = await bcrypt.hash(password, config.bcryptRounds);

    const outcome = await store.update((users) => {
      const target = users.find((entry) => entry.resetTokenHash === tokenHash);
      if (!target || target.resetTokenUsed !== false) {
        return { ok: false };
      }
      const expiresAt = target.resetTokenExpiresAt ? Date.parse(target.resetTokenExpiresAt) : 0;
      if (!expiresAt || expiresAt <= Date.now()) {
        return { ok: false };
      }

      target.passwordHash = newPasswordHash;
      target.resetTokenUsed = true;
      target.failedLoginCount = 0;
      target.lockedUntil = null;
      return { ok: true, userId: target.id };
    });

    if (!outcome.ok) {
      return res.status(400).json({ error: MSG_RESET_INVALID });
    }

    sessionStore.destroyByUserId(outcome.userId);
    res.clearCookie(sessionStore.cookieName, baseCookieOptions(config));

    return res.json({
      message: 'Password berhasil diubah. Silakan login.',
      redirect: '/login.html?reset=1'
    });
  });

  return router;
}

module.exports = { createAuthRouter };

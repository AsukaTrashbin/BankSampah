'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { buildConfig } = require('./config');
const { createUserStore, DataFileError } = require('./user-store');
const { createSessionStore } = require('./sessions');
const { createMailer } = require('./mailer');
const { createAuthRouter } = require('./auth');

function parseCookies(header) {
  const cookies = {};
  if (!header) {
    return cookies;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    if (!name) {
      continue;
    }
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch (error) {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

function buildHelmetOptions(config) {
  const options = {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
          'https://fonts.googleapis.com'
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
        imgSrc: [
          "'self'",
          'data:',
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
          'https://tile.openstreetmap.org',
          'https://*.tile.openstreetmap.org'
        ],
        connectSrc: ["'self'", 'https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null
      }
    },
    crossOriginEmbedderPolicy: false
  };

  if (config.nodeEnv !== 'production') {
    options.strictTransportSecurity = false;
  }

  return options;
}

function isBlockedStaticPath(pathname) {
  const lower = pathname.toLowerCase();
  const blockedPrefixes = [
    '/server',
    '/test',
    '/tests',
    '/node_modules',
    '/data',
    '/.git',
    '/.env'
  ];

  if (blockedPrefixes.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`))) {
    return true;
  }
  if (lower.startsWith('/backup-auth-')) {
    return true;
  }
  if (lower.startsWith('/.')) {
    return true;
  }

  return [
    '/users.json',
    '/package.json',
    '/package-lock.json'
  ].includes(lower);
}

async function createApp(options) {
  const opts = options || {};
  const config = buildConfig(opts.config);
  const store = opts.store || createUserStore(config.usersFile);
  await store.init();

  const sessionStore = opts.sessionStore || createSessionStore(config);
  const mailer = opts.mailer || createMailer(config);
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet(buildHelmetOptions(config)));
  app.use(express.json({ limit: '10kb' }));

  app.use((req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    req.session = sessionStore.getFromCookie(cookies[sessionStore.cookieName]);
    next();
  });

  app.use((req, res, next) => {
    if (isBlockedStaticPath(req.path)) {
      return res.status(404).type('text/plain').send('Halaman tidak ditemukan.');
    }
    return next();
  });

  app.use('/api/auth', createAuthRouter({ config, store, sessionStore, mailer }));

  app.get('/dashboard', (req, res) => res.redirect(302, '/dashboard.html'));

  app.get('/dashboard.html', async (req, res, next) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.redirect(302, `/login.html?next=${encodeURIComponent('/dashboard.html')}`);
      }
      const user = await store.findById(req.session.userId);
      if (!user) {
        sessionStore.destroy(req.session);
        return res.redirect(302, `/login.html?next=${encodeURIComponent('/dashboard.html')}`);
      }
      return res.sendFile(path.join(config.rootDir, 'dashboard.html'));
    } catch (error) {
      return next(error);
    }
  });

  app.use(express.static(config.rootDir, {
    index: 'index.html',
    dotfiles: 'deny',
    etag: true,
    maxAge: config.nodeEnv === 'production' ? '1h' : 0
  }));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  });

  app.use((req, res) => {
    res.status(404).type('text/plain').send('Halaman tidak ditemukan.');
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({ error: 'Permintaan tidak valid.' });
    }

    if (error instanceof DataFileError || error.code === 'DATA_FILE_CORRUPT') {
      console.error('[data] File data user tidak dapat diproses. File tidak ditimpa.');
      return res.status(503).json({ error: 'Penyimpanan data sedang tidak tersedia.' });
    }

    console.error('[server] Kesalahan internal:', error.message);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  });

  return { app, config, store, sessionStore, mailer };
}

module.exports = { createApp };

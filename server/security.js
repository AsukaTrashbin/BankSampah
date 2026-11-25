'use strict';

const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');

function tokensMatch(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function csrfProtection() {
  return function csrfMiddleware(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const headerToken = req.get('x-csrf-token');
    const sessionToken = req.session && req.session.csrfToken;

    if (!sessionToken || !headerToken || !tokensMatch(headerToken, sessionToken)) {
      return res.status(403).json({ error: 'Permintaan tidak valid. Muat ulang halaman lalu coba lagi.' });
    }

    return next();
  };
}

function rateLimitHandler(message) {
  return function handleLimit(req, res) {
    res.status(429).json({ error: message });
  };
}

function createRateLimiters(config) {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.loginRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: rateLimitHandler('Terlalu banyak percobaan. Coba lagi nanti.')
  });

  const forgotLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.forgotRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: rateLimitHandler('Terlalu banyak permintaan. Coba lagi nanti.')
  });

  return { loginLimiter, forgotLimiter };
}

module.exports = { csrfProtection, createRateLimiters };

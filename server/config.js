'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT_DIR = path.join(__dirname, '..');

function loadEnv() {
  const envFile = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

function buildConfig(overrides) {
  const options = overrides || {};
  const env = process.env;
  const nodeEnv = options.nodeEnv || env.NODE_ENV || 'development';
  const port = Number(options.port || env.PORT || 3000);
  const sessionSecret = options.sessionSecret ||
    env.SESSION_SECRET ||
    (nodeEnv === 'production' ? '' : crypto.randomBytes(32).toString('hex'));

  if (!sessionSecret) {
    throw new Error('SESSION_SECRET wajib diatur ketika NODE_ENV=production.');
  }

  const baseUrl = String(options.baseUrl || env.BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  const secureCookies = options.secureCookies !== undefined
    ? Boolean(options.secureCookies)
    : (env.COOKIE_SECURE === 'true' || nodeEnv === 'production');

  return {
    rootDir: ROOT_DIR,
    port,
    nodeEnv,
    baseUrl,
    sessionSecret,
    usersFile: options.usersFile || env.USERS_FILE || path.join(__dirname, 'data', 'users.json'),
    secureCookies,
    sessionTtlMs: options.sessionTtlMs || 24 * 60 * 60 * 1000,
    rememberTtlMs: options.rememberTtlMs || 7 * 24 * 60 * 60 * 1000,
    anonymousTtlMs: options.anonymousTtlMs || 60 * 60 * 1000,
    resetTokenTtlMs: options.resetTokenTtlMs || 30 * 60 * 1000,
    bcryptRounds: Number(options.bcryptRounds || env.BCRYPT_ROUNDS || 12),
    loginRateLimitMax: Number(options.loginRateLimitMax || env.LOGIN_RATE_LIMIT_MAX || 10),
    forgotRateLimitMax: Number(options.forgotRateLimitMax || env.FORGOT_RATE_LIMIT_MAX || 5),
    logResetLinks: options.logResetLinks !== undefined
      ? Boolean(options.logResetLinks)
      : nodeEnv !== 'production',
    smtp: options.smtp || {
      host: env.SMTP_HOST || '',
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === 'true',
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.SMTP_FROM || env.SMTP_USER || ''
    }
  };
}

module.exports = { ROOT_DIR, loadEnv, buildConfig };

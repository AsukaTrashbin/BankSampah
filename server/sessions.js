'use strict';

const crypto = require('node:crypto');

const COOKIE_NAME = 'citybin.sid';

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function createSessionStore(config) {
  const sessions = new Map();

  function makeSession(userId, ttlMs) {
    const sid = crypto.randomBytes(32).toString('base64url');
    const session = {
      id: sid,
      userId: userId || null,
      csrfToken: crypto.randomBytes(32).toString('hex'),
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    };
    sessions.set(sid, session);
    return session;
  }

  function cookieValue(sessionId) {
    return `${sessionId}.${sign(sessionId, config.sessionSecret)}`;
  }

  function parseSignedCookie(rawValue) {
    if (!rawValue || typeof rawValue !== 'string') {
      return null;
    }
    const separator = rawValue.lastIndexOf('.');
    if (separator <= 0) {
      return null;
    }
    const sid = rawValue.slice(0, separator);
    const signature = rawValue.slice(separator + 1);
    if (!safeEqual(signature, sign(sid, config.sessionSecret))) {
      return null;
    }
    return sid;
  }

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of sessions) {
      if (session.expiresAt <= now) {
        sessions.delete(sid);
      }
    }
  }, 10 * 60 * 1000);
  if (typeof cleanup.unref === 'function') {
    cleanup.unref();
  }

  return {
    cookieName: COOKIE_NAME,

    getFromCookie(rawValue) {
      const sid = parseSignedCookie(rawValue);
      if (!sid) {
        return null;
      }
      const session = sessions.get(sid);
      if (!session) {
        return null;
      }
      if (session.expiresAt <= Date.now()) {
        sessions.delete(sid);
        return null;
      }
      return session;
    },

    create(userId, ttlMs) {
      return makeSession(userId, ttlMs);
    },

    rotate(previousSession, userId, ttlMs) {
      if (previousSession) {
        sessions.delete(previousSession.id);
      }
      return makeSession(userId, ttlMs);
    },

    destroy(session) {
      if (session) {
        sessions.delete(session.id);
      }
    },

    destroyByUserId(userId) {
      for (const [sid, session] of sessions) {
        if (session.userId === userId) {
          sessions.delete(sid);
        }
      }
    },

    cookieValue
  };
}

function baseCookieOptions(config) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/'
  };
}

module.exports = { createSessionStore, baseCookieOptions, COOKIE_NAME };

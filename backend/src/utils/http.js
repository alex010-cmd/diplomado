'use strict';

const { config } = require('../config/env');
const { COOKIES } = require('./constants');

// [E5.2: sesión corta] Access 15 min + refresh rotativo 7 días, ambos en cookies
// httpOnly + SameSite=Strict + Secure en prod => mitigación CSRF y XSS.
function cookieOptions(maxAgeMs, path = '/') {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    maxAge: maxAgeMs,
    path,
  };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(COOKIES.ACCESS, accessToken, cookieOptions(config.accessTokenTtlMs));
  res.cookie(COOKIES.REFRESH, refreshToken, cookieOptions(config.refreshTokenTtlMs));
}

function clearAuthCookies(res) {
  res.clearCookie(COOKIES.ACCESS, cookieOptions(0));
  res.clearCookie(COOKIES.REFRESH, cookieOptions(0));
}

module.exports = { cookieOptions, setAuthCookies, clearAuthCookies };

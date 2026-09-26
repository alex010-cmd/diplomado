'use strict';

const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

function signAccessToken(payload) {
  return jwt.sign(payload, config.jwtAccessSecret, {
    expiresIn: config.accessTokenTtl,
    issuer: 'portal-academico',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.refreshTokenTtl,
    issuer: 'portal-academico',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtAccessSecret, { issuer: 'portal-academico' });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret, { issuer: 'portal-academico' });
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};

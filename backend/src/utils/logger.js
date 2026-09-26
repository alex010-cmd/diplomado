'use strict';

const pino = require('pino');
const { config } = require('../config/env');

// pino: logger estructurado. Nunca registrar contrasenas/tokens (redact).
const logger = pino({
  level: config.nodeEnv === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'password',
      'password_hash',
      'passwordHash',
      'token',
      'access_token',
      'refresh_token',
      'authorization',
      'cookie',
      'set-cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;

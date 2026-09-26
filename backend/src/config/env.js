'use strict';

const path = require('path');
require('dotenv').config();

/**
 * Convierte duraciones estilo "15m", "7d", "1h", "30s" a milisegundos.
 * Usado para los TTL de cookies y tokens.
 */
function parseDurationMs(value, fallbackMs) {
  if (!value || typeof value !== 'string') return fallbackMs;
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) return fallbackMs;
  const n = Number(match[1]);
  const unit = match[2];
  const factors = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * factors[unit];
}

function parseIntEnv(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const accessTtl = process.env.ACCESS_TOKEN_TTL || '15m';
const refreshTtl = process.env.REFRESH_TOKEN_TTL || '7d';

const config = {
  nodeEnv,
  isProd,
  port: parseIntEnv(process.env.PORT, 3000),
  dbPath: path.resolve(process.cwd(), process.env.DATABASE_PATH || './backend/data/app.db'),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'insecure-dev-access-secret-change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'insecure-dev-refresh-secret-change-me',
  accessTokenTtl: accessTtl,
  refreshTokenTtl: refreshTtl,
  accessTokenTtlMs: parseDurationMs(accessTtl, 15 * 60 * 1000),
  refreshTokenTtlMs: parseDurationMs(refreshTtl, 7 * 24 * 60 * 60 * 1000),
  bcryptCost: parseIntEnv(process.env.BCRYPT_COST, 12),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === 'true',
};

// Valida que no se usen secretos por defecto en produccion (seguridad de configuracion).
if (isProd) {
  if (config.jwtAccessSecret === 'insecure-dev-access-secret-change-me' ||
      config.jwtRefreshSecret === 'insecure-dev-refresh-secret-change-me') {
    throw new Error('Configuracion insegura: define JWT_ACCESS_SECRET y JWT_REFRESH_SECRET en produccion.');
  }
}

module.exports = { config };

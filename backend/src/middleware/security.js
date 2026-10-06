'use strict';

const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { config } = require('../config/env');

const allowedOrigins = config.corsOrigins;

// [E5.2: cabeceras HTTP] CSP estricta: default-src 'self', sin unsafe-inline.
// Todos los scripts/estilos deben estar en archivos externos del propio origen.
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'"],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
};

function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: cspDirectives,
    },
    // COEP require-corp: la app es 100% mismo-origen, sin recursos externos.
    crossOriginEmbedderPolicy: true,
    // HSTS solo en produccion (en HTTP local causaria problemas).
    strictTransportSecurity: config.isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    xContentTypeOptions: true,
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    xFrameOptions: { action: 'deny' },
  });
}

// Helmet no incluye Permissions-Policy: se fija con middleware propio.
// Niega sensores/APIs que la app no necesita (defensa en profundidad).
function permissionsPolicy() {
  const value = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'picture-in-picture=()',
  ].join(', ');
  return (req, res, next) => {
    res.setHeader('Permissions-Policy', value);
    next();
  };
}

// CORS restringido a whitelist de origenes.
function corsWhitelist() {
  return cors({
    origin(origin, cb) {
      // Sin header Origin (ej. curl, peticiones server-to-server): permitir.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false); // sin header ACAO => el navegador bloquea
    },
    credentials: true,
  });
}

// [E5.2: API anti-CSRF] Verifica el header Origin en métodos mutantes, además
// de SameSite=Strict en cookies y CORS con whitelist.
function verifyOrigin() {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'Origen no autorizado' });
    }
    next();
  };
}

function jsonRateLimitBody(message) {
  return { error: message || 'Demasiadas solicitudes. Intentalo mas tarde.' };
}

// [E5.2: rate limiting] Global 100/min, login 5/min (fuerza bruta) y
// búsquedas 30/min (abuso/scraping de datos sensibles).
function globalLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: jsonRateLimitBody('Demasiadas solicitudes. Intentalo mas tarde.'),
  });
}

function loginLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: jsonRateLimitBody('Demasiados intentos de inicio de sesion. Intentalo mas tarde.'),
  });
}

function searchLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: jsonRateLimitBody('Demasiadas busquedas. Intentalo mas tarde.'),
  });
}

module.exports = {
  securityHeaders,
  permissionsPolicy,
  corsWhitelist,
  verifyOrigin,
  globalLimiter,
  loginLimiter,
  searchLimiter,
  allowedOrigins,
};

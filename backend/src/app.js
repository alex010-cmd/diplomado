'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { config } = require('./config/env');
const {
  securityHeaders,
  permissionsPolicy,
  corsWhitelist,
  verifyOrigin,
  globalLimiter,
  loginLimiter,
  searchLimiter,
} = require('./middleware/security');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { createApiRouter } = require('./routes');

/**
 * Fabrica la aplicacion Express. Se exporta como funcion para que los smoke
 * tests puedan instanciar aplicaciones aisladas (p.ej. rate limiting fresco).
 */
function createApp() {
  const app = express();

  // Confianza en proxy inverso (establece req.ip correcto tras un proxy).
  app.set('trust proxy', config.trustProxy ? 1 : false);

  // Cabeceras de seguridad HTTP (helmet + CSP estricta + HSTS en produccion).
  app.use(securityHeaders());
  // Permissions-Policy (helmet no la incluye: middleware propio).
  app.use(permissionsPolicy());

  // Parseo de JSON (limite de tamano) y cookies.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // CORS restringido a whitelist + verificacion de Origin en metodos mutantes.
  app.use(corsWhitelist());
  app.use(verifyOrigin());

  // Rate limiting global.
  app.use(globalLimiter());

  // Redireccion a HTTPS en produccion (defensa en profundidad).
  if (config.isProd) {
    app.use((req, res, next) => {
      if (req.headers['x-forwarded-proto'] === 'http') {
        return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
      }
      next();
    });
  }

  // API (con limitadores propios por instancia de app).
  app.use(
    '/api',
    createApiRouter({ loginRateLimiter: loginLimiter(), searchRateLimiter: searchLimiter() })
  );

  // Frontend estatico (HTML/CSS/JS en archivos externos, sin inline).
  app.use(express.static(path.join(__dirname, '../public')));

  // 404 JSON y manejador centralizado de errores.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

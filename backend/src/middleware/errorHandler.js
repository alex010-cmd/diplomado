'use strict';

const logger = require('../utils/logger');
const { config } = require('../config/env');

// 404 en formato JSON para endpoints API inexistentes.
function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

// [E5.2: errores y configuración] Handler centralizado: detalle solo en
// desarrollo (nunca datos sensibles); en producción, mensaje genérico + 404 JSON.
function errorHandler(err, req, res, _next) {
  if (err && err.type === 'entity.too.large') {
    logger.warn({ method: req.method, url: req.originalUrl, ip: req.ip }, 'cuerpo demasiado grande');
    return res.status(413).json({ error: 'Cuerpo de la solicitud demasiado grande' });
  }
  if (err && err.type === 'entity.parse.failed') {
    logger.warn({ method: req.method, url: req.originalUrl, ip: req.ip }, 'JSON invalido');
    return res.status(400).json({ error: 'JSON invalido' });
  }

  // Los errores esperados 4xx (p.ej. "Credenciales invalidas") ya quedan en
  // audit_log; aqui solo se registran como aviso para no ensuciar el log.
  if (err && Number.isInteger(err.status) && err.status < 500) {
    logger.warn({ status: err.status, method: req.method, url: req.originalUrl, ip: req.ip }, 'solicitud rechazada');
    return res.status(err.status).json({ error: err.message || 'Solicitud invalida' });
  }

  logger.error({ err, method: req.method, url: req.originalUrl, ip: req.ip }, 'error no controlado');

  if (config.nodeEnv === 'development') {
    return res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { notFoundHandler, errorHandler };

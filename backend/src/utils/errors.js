'use strict';

/**
 * Error de aplicacion con codigo HTTP, para devolver respuestas controladas
 * con mensajes genericos al cliente.
 */
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

function badRequest(message) {
  return new AppError(400, message);
}

function unauthorized(message) {
  return new AppError(401, message);
}

function forbidden(message) {
  return new AppError(403, message);
}

function notFound(message) {
  return new AppError(404, message);
}

function conflict(message) {
  return new AppError(409, message);
}

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict };

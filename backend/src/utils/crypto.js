'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { config } = require('../config/env');

const BCRYPT_COST = config.bcryptCost;

// [E5.2: autenticación + Fase 5 BCrypt] Hash bcrypt con cost 12 (OWASP): lento a
// propósito contra fuerza bruta; el cost sube sin cambiar el código.
// Hash de contrasena con bcrypt (cost configurable, 12 por defecto).
function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

// Verificacion con comparacion en tiempo no trivial (bcrypt ya es lento a proposito).
function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

// Hash "dummy" usado para igualar el tiempo de respuesta cuando el usuario NO existe
// (contra-ataque de enumeracion de usuarios por timing).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-constant-time', BCRYPT_COST);

// Hash sha-256 para almacenar refresh tokens (nunca en claro).
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Genera un token aleatorio (refresh token) criptograficamente seguro.
function generateTokenValue(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = { hashPassword, verifyPassword, DUMMY_HASH, sha256, generateTokenValue };

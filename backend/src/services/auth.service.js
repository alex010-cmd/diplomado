'use strict';

const db = require('../config/db');
const { hashPassword, verifyPassword, DUMMY_HASH, sha256, generateTokenValue } = require('../utils/crypto');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { setAuthCookies, clearAuthCookies } = require('../utils/http');
const { ROLES, RESULT, ACTIONS, COOKIES } = require('../utils/constants');
const { logAudit } = require('./audit.service');
const { unauthorized, conflict } = require('../utils/errors');
const { config } = require('../config/env');

const findByEmail = db.prepare('SELECT id, name, email, password_hash, role, active FROM users WHERE email = ?');
const findByEmailAny = db.prepare('SELECT id FROM users WHERE email = ?');
const findByIdStmt = db.prepare('SELECT id, name, email, role, active FROM users WHERE id = ?');

// Busca un usuario por id (objeto publico, sin password_hash).
function findById(id) {
  return findByIdStmt.get(id);
}
const insertUser = db.prepare(
  'INSERT INTO users (name, email, password_hash, role, active) VALUES (@name, @email, @password_hash, @role, 1)'
);
const insertRefresh = db.prepare(
  'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) VALUES (@user_id, @token_hash, @expires_at, @created_at)'
);
const revokeRefresh = db.prepare(
  'UPDATE refresh_tokens SET revoked_at = @now WHERE token_hash = @token_hash AND revoked_at IS NULL'
);
const findRefresh = db.prepare(
  'SELECT id, user_id FROM refresh_tokens WHERE token_hash = @token_hash AND revoked_at IS NULL AND expires_at > @now'
);

// Mapea a objeto publico SIN password_hash (regla: nunca exponer el hash).
function toPublicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.active };
}

function issueTokens(user, res) {
  const accessToken = signAccessToken({
    sub: String(user.id),
    role: user.role,
    name: user.name,
    email: user.email,
  });
  const refreshRaw = generateTokenValue();
  const refreshPayload = { sub: String(user.id) };
  const refreshToken = signRefreshToken(refreshPayload);

  // Rotacion: se almacena SOLO el hash del refresh token.
  insertRefresh.run({
    user_id: user.id,
    token_hash: sha256(refreshRaw),
    expires_at: Date.now() + config.refreshTokenTtlMs,
    created_at: Date.now(),
  });

  setAuthCookies(res, accessToken, refreshToken);
  return accessToken;
}

function register({ name, email, password }) {
  const existing = findByEmailAny.get(email);
  if (existing) throw conflict('El correo ya esta registrado.');

  const info = insertUser.run({
    name,
    email,
    password_hash: hashPassword(password),
    role: ROLES.ESTUDIANTE,
  });
  const user = findByIdStmt.get(info.lastInsertRowid);
  logAudit({ userId: user.id, action: ACTIONS.REGISTER, entity: 'user', entityId: user.id, result: RESULT.SUCCESS });
  return toPublicUser(user);
}

/**
 * [E5.2: errores genéricos anti-enumeración] Mensaje único "Credenciales
 * invalidas" exista o no el usuario, con tiempo de respuesta constante
 * (comparación contra hash dummy del mismo coste si no existe).
 */
function login({ email, password }, req, res) {
  const user = findByEmail.get(email);
  const auditMeta = { action: ACTIONS.LOGIN_FAILURE, entity: 'auth', result: RESULT.FAILURE, ip: req.ip, userAgent: req.get('user-agent') };

  if (!user) {
    verifyPassword(password, DUMMY_HASH); // iguala timing, descarta resultado
    logAudit({ userId: null, ...auditMeta });
    throw unauthorized('Credenciales invalidas');
  }

  const ok = verifyPassword(password, user.password_hash);
  if (!ok || !user.active) {
    logAudit({ userId: user.id, ...auditMeta });
    throw unauthorized('Credenciales invalidas');
  }

  issueTokens(user, res);
  logAudit({
    userId: user.id,
    action: ACTIONS.LOGIN_SUCCESS,
    entity: 'auth',
    entityId: user.id,
    result: RESULT.SUCCESS,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  return toPublicUser(user);
}

function refresh(req, res) {
  const raw = req.cookies ? req.cookies[COOKIES.REFRESH] : undefined;
  if (!raw) {
    logAudit({ userId: null, action: ACTIONS.ACCESS_DENIED, entity: 'refresh', result: RESULT.DENIED, ip: req.ip, userAgent: req.get('user-agent') });
    throw unauthorized('No autorizado');
  }

  let payload;
  try {
    payload = verifyRefreshToken(raw);
  } catch (err) {
    logAudit({ userId: null, action: ACTIONS.ACCESS_DENIED, entity: 'refresh', result: RESULT.DENIED, ip: req.ip, userAgent: req.get('user-agent') });
    throw unauthorized('No autorizado');
  }

  const tokenHash = sha256(raw);
  const stored = findRefresh.get({ token_hash: tokenHash, now: Date.now() });
  if (!stored) {
    logAudit({ userId: null, action: ACTIONS.ACCESS_DENIED, entity: 'refresh', result: RESULT.DENIED, ip: req.ip, userAgent: req.get('user-agent') });
    throw unauthorized('No autorizado');
  }

  const user = findByIdStmt.get(stored.user_id);
  if (!user || !user.active) {
    throw unauthorized('No autorizado');
  }

  // Rotacion: revoca el token usado y emite uno nuevo.
  revokeRefresh.run({ token_hash: tokenHash, now: Date.now() });
  issueTokens(user, res);
  logAudit({ userId: user.id, action: ACTIONS.REFRESH, entity: 'auth', result: RESULT.SUCCESS, ip: req.ip, userAgent: req.get('user-agent') });
  return toPublicUser(user);
}

function logout(req, res) {
  const raw = req.cookies ? req.cookies[COOKIES.REFRESH] : undefined;
  if (raw) {
    revokeRefresh.run({ token_hash: sha256(raw), now: Date.now() });
  }
  clearAuthCookies(res);
  logAudit({
    userId: req.user ? req.user.id : null,
    action: ACTIONS.LOGOUT,
    entity: 'auth',
    result: RESULT.SUCCESS,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
}

module.exports = { register, login, refresh, logout, toPublicUser, findById };

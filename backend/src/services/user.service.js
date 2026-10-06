'use strict';

const db = require('../config/db');
const { hashPassword } = require('../utils/crypto');
const { ROLES } = require('../utils/constants');
const { badRequest, notFound, conflict } = require('../utils/errors');

// [E5.1: DESPUÉS] Prepared statement con parámetro @like: el texto buscado viaja
// como dato, nunca como sintaxis (ver demo antes/después en docs/ejercicio-5-1).
// Ninguna consulta selecciona password_hash => nunca se expone el hash.
const listUsersStmt = db.prepare(`
  SELECT id, name, email, role, active, created_at
  FROM users
  WHERE (@search IS NULL OR name LIKE @like OR email LIKE @like)
  ORDER BY id ASC
  LIMIT @limit OFFSET @offset
`);
const countUsersStmt = db.prepare(`
  SELECT COUNT(*) AS c FROM users
  WHERE (@search IS NULL OR name LIKE @like OR email LIKE @like)
`);
const findByEmailStmt = db.prepare('SELECT id FROM users WHERE email = ?');
const findByIdStmt = db.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?');
const insertUserStmt = db.prepare(
  'INSERT INTO users (name, email, password_hash, role, active) VALUES (@name, @email, @password_hash, @role, 1)'
);
const updateUserStmt = db.prepare(`
  UPDATE users SET
    name = COALESCE(@name, name),
    role = COALESCE(@role, role),
    active = COALESCE(@active, active)
  WHERE id = @id
`);

function listUsers({ search = '', limit = 100, offset = 0 }) {
  const like = search ? `%${search}%` : null;
  const params = { search: search || null, like, limit, offset };
  const rows = listUsersStmt.all(params);
  const total = countUsersStmt.get({ search: search || null, like }).c;
  return { rows, total };
}

function getUserById(id) {
  const u = findByIdStmt.get(id);
  if (!u) throw notFound('Usuario no encontrado');
  return u;
}

function createUser({ name, email, password, role }) {
  if (findByEmailStmt.get(email)) throw conflict('El correo ya esta registrado.');
  if (!Object.values(ROLES).includes(role)) throw badRequest('Rol invalido.');
  const info = insertUserStmt.run({
    name,
    email,
    password_hash: hashPassword(password),
    role,
  });
  return findByIdStmt.get(info.lastInsertRowid);
}

function updateUser(id, { name, role, active }, actor) {
  const target = findByIdStmt.get(id);
  if (!target) throw notFound('Usuario no encontrado');

  if (actor && actor.id === id && active === false) {
    throw badRequest('No puedes desactivar tu propia cuenta.');
  }
  if (actor && actor.id === id && role && role !== target.role) {
    throw badRequest('No puedes cambiar tu propio rol.');
  }

  updateUserStmt.run({
    id,
    name: name || null,
    role: role || null,
    active: active === undefined ? null : (active ? 1 : 0),
  });
  return findByIdStmt.get(id);
}

module.exports = { listUsers, getUserById, createUser, updateUser };

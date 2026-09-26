'use strict';

/**
 * [E5.1: DESPUÉS] Versión refactorizada y segura.
 * Espejo didáctico de `backend/src/services/user.service.js :: listUsers`.
 * Capas de defensa aplicadas:
 *  1. Prepared statement: el input viaja como DATO (@like), nunca como sintaxis.
 *  2. Validación de formato en servidor: longitud máxima + caracteres permitidos
 *     (en la app real lo hace zod en `backend/src/schemas.js :: searchQuery`).
 *  3. Proyección mínima: nunca se selecciona password_hash (aunque aquí la
 *     tabla demo ni siquiera tiene esa columna).
 */

const Database = require('better-sqlite3');

// [E5.1: validación de formato en servidor] Longitud + allowlist de caracteres.
const SEARCH_REGEX = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ @._-]{0,100}$/;

function validarBusqueda(q) {
  if (typeof q !== 'string') throw new Error('Búsqueda inválida: debe ser texto.');
  if (q.length > 100) throw new Error('Búsqueda inválida: máximo 100 caracteres.');
  if (!SEARCH_REGEX.test(q)) throw new Error('Búsqueda inválida: caracteres no permitidos.');
  return q.trim();
}

function crearBDdemo() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT);
    INSERT INTO users (name, email, role) VALUES
      ('Ana Torres', 'ana@universidad.edu', 'estudiante'),
      ('Luis Perez', 'luis@universidad.edu', 'estudiante'),
      ('Admin General', 'admin@universidad.edu', 'admin');
  `);
  return db;
}

// [E5.1: DESPUÉS] ✅ Parámetro enlazado: el payload viaja como texto literal.
const buscarStmt = (db) =>
  db.prepare(`
    SELECT id, name, email, role FROM users
    WHERE (@q IS NULL OR name LIKE @like OR email LIKE @like)
  `);

function buscarUsuariosSeguro(db, q) {
  const limpio = validarBusqueda(q); // capa 2: validación antes de tocar la BD
  const like = limpio ? `%${limpio}%` : null; // el % se añade en JS, no en SQL
  return buscarStmt(db).all({ q: limpio || null, like }); // capa 1: binding
}

module.exports = { crearBDdemo, buscarUsuariosSeguro, validarBusqueda };

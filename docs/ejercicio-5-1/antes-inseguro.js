'use strict';

/**
 * ============================================================================
 * [E5.1: ANTES] Versión INTENCIONALMENTE VULNERABLE — solo con fines educativos.
 * NO se usa en la aplicación. NO importar este archivo desde backend/src.
 * Sirve para demostrar el ataque del Ejercicio 5.1 antes de la refactorización.
 * ============================================================================
 *
 * Vulnerabilidad: concatenación de cadenas en SQL (CWE-89).
 * El parámetro `q` del usuario se pega directamente en la consulta, así que el
 * payload clásico `' OR '1'='1` altera la lógica del WHERE y devuelve TODOS
 * los usuarios (fuga de datos sensibles).
 */

const Database = require('better-sqlite3');

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

// [E5.1: ANTES] ❌ Concatenación directa: el input controla la sintaxis SQL.
function buscarUsuariosInseguro(db, q) {
  const sql = "SELECT id, name, email, role FROM users WHERE name LIKE '%" + q + "%'";
  return db.prepare(sql).all(); // la consulta ya nace contaminada
}

module.exports = { crearBDdemo, buscarUsuariosInseguro };

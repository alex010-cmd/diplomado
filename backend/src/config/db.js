'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { config } = require('./env');

// Asegura que el directorio de datos exista.
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);

// Medidas de robustez e integridad.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// Aplica el esquema (idempotente por IF NOT EXISTS).
const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;

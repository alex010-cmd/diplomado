'use strict';

const db = require('../config/db');
const { hashPassword } = require('../utils/crypto');
const { ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password_hash, role, active)
  VALUES (@name, @email, @password_hash, @role, 1)
`);
const findUserByEmail = db.prepare('SELECT id FROM users WHERE email = ?');
const insertCourse = db.prepare(`
  INSERT OR IGNORE INTO cursos (codigo, nombre, descripcion, profesor_id)
  VALUES (@codigo, @nombre, @descripcion, @profesor_id)
`);
const findCourseByCodigo = db.prepare('SELECT id FROM cursos WHERE codigo = ?');
const insertEnroll = db.prepare(`
  INSERT OR IGNORE INTO inscripciones (curso_id, estudiante_id) VALUES (@curso_id, @estudiante_id)
`);
const insertNota = db.prepare(`
  INSERT OR IGNORE INTO notas (curso_id, estudiante_id, valor)
  VALUES (@curso_id, @estudiante_id, @valor)
`);

function upsertUser(name, email, password, role) {
  insertUser.run({ name, email, password_hash: hashPassword(password), role });
  return findUserByEmail.get(email).id;
}

function upsertCourse(codigo, nombre, descripcion, profesorId) {
  insertCourse.run({ codigo, nombre, descripcion, profesor_id: profesorId });
  return findCourseByCodigo.get(codigo).id;
}

function runSeed() {
  const admin = upsertUser('Admin General', 'admin@universidad.edu', 'Admin123', ROLES.ADMIN);
  const profGarcia = upsertUser('Prof. Carla Garcia', 'prof.garcia@universidad.edu', 'Profesor123', ROLES.PROFESOR);
  const profLopez = upsertUser('Prof. Jose Lopez', 'prof.lopez@universidad.edu', 'Profesor123', ROLES.PROFESOR);
  const ana = upsertUser('Ana Torres', 'ana@universidad.edu', 'Estudiante123', ROLES.ESTUDIANTE);
  const luis = upsertUser('Luis Perez', 'luis@universidad.edu', 'Estudiante123', ROLES.ESTUDIANTE);
  const maria = upsertUser('Maria Ruiz', 'maria@universidad.edu', 'Estudiante123', ROLES.ESTUDIANTE);

  const cs101 = upsertCourse('CS-101', 'Seguridad Informatica', 'Fundamentos de ciberseguridad defensiva.', profGarcia);
  const cs102 = upsertCourse('CS-102', 'Desarrollo Web Seguro', 'Buenas practicas de AppSec en la web.', profGarcia);
  const mat201 = upsertCourse('MAT-201', 'Criptografia Aplicada', 'Primitivas criptograficas y sus aplicaciones.', profLopez);

  insertEnroll.run({ curso_id: cs101, estudiante_id: ana });
  insertEnroll.run({ curso_id: cs102, estudiante_id: ana });
  insertEnroll.run({ curso_id: cs101, estudiante_id: luis });
  insertEnroll.run({ curso_id: cs102, estudiante_id: maria });
  insertEnroll.run({ curso_id: mat201, estudiante_id: maria });

  insertNota.run({ curso_id: cs101, estudiante_id: ana, valor: 85 });
  insertNota.run({ curso_id: cs102, estudiante_id: ana, valor: 90 });
  insertNota.run({ curso_id: cs101, estudiante_id: luis, valor: 72 });
  insertNota.run({ curso_id: cs102, estudiante_id: maria, valor: 95 });
  insertNota.run({ curso_id: mat201, estudiante_id: maria, valor: 88 });

  logger.info({ admin, profGarcia, profLopez, cursos: [cs101, cs102, mat201] }, 'seed completado');
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };

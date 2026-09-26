'use strict';

const db = require('../config/db');
const { ROLES } = require('../utils/constants');
const { forbidden, notFound } = require('../utils/errors');
const { getCourse, assertProfessorOwnsCourse } = require('./course.service');

// [E5.2: anti-IDOR] Estudiante: SOLO sus propias notas, id derivado de la
// sesion, nunca del query (no existe parámetro para pedir notas ajenas).
const studentGradesStmt = db.prepare(`
  SELECT n.id, n.valor, n.updated_at, c.id AS curso_id, c.codigo, c.nombre AS curso_nombre
  FROM notas n
  JOIN cursos c ON c.id = n.curso_id
  WHERE n.estudiante_id = @estudiante_id
  ORDER BY c.nombre ASC
`);
// Profesor: notas de los cursos que imparte.
const professorGradesStmt = db.prepare(`
  SELECT n.id, n.valor, n.updated_at, c.id AS curso_id, c.codigo, c.nombre AS curso_nombre,
         u.id AS estudiante_id, u.name AS estudiante_nombre
  FROM notas n
  JOIN cursos c ON c.id = n.curso_id
  JOIN users u ON u.id = n.estudiante_id
  WHERE c.profesor_id = @profesor_id
  ORDER BY c.nombre ASC, u.name ASC
`);
// Admin: todas las notas.
const allGradesStmt = db.prepare(`
  SELECT n.id, n.valor, n.updated_at, c.id AS curso_id, c.codigo, c.nombre AS curso_nombre,
         u.id AS estudiante_id, u.name AS estudiante_nombre
  FROM notas n
  JOIN cursos c ON c.id = n.curso_id
  JOIN users u ON u.id = n.estudiante_id
  ORDER BY c.nombre ASC, u.name ASC
`);
const upsertStmt = db.prepare(`
  INSERT INTO notas (curso_id, estudiante_id, valor, updated_at)
  VALUES (@curso_id, @estudiante_id, @valor, datetime('now'))
  ON CONFLICT (curso_id, estudiante_id)
  DO UPDATE SET valor = @valor, updated_at = datetime('now')
`);
const studentExistsStmt = db.prepare('SELECT id, role FROM users WHERE id = ?');
const enrolledStmt = db.prepare(
  'SELECT id FROM inscripciones WHERE curso_id = @curso_id AND estudiante_id = @estudiante_id'
);

function listGradesForUser(user) {
  if (user.role === ROLES.ADMIN) return allGradesStmt.all();
  if (user.role === ROLES.PROFESOR) return professorGradesStmt.all({ profesor_id: user.id });
  return studentGradesStmt.all({ estudiante_id: user.id });
}

// Profesor (dueno del curso) o admin crean/editan una nota.
function upsertGrade(courseId, { studentId, valor }, user) {
  const course = getCourse(courseId);
  if (user.role === ROLES.PROFESOR) {
    assertProfessorOwnsCourse(user, course);
  } else if (user.role !== ROLES.ADMIN) {
    throw forbidden('No autorizado');
  }

  const student = studentExistsStmt.get(studentId);
  if (!student || student.role !== ROLES.ESTUDIANTE) throw notFound('Estudiante no encontrado');
  if (!enrolledStmt.get({ curso_id: courseId, estudiante_id: studentId })) {
    throw notFound('El estudiante no esta inscrito en este curso.');
  }

  upsertStmt.run({ curso_id: courseId, estudiante_id: studentId, valor });
  return { curso_id: courseId, estudiante_id: studentId, valor };
}

module.exports = { listGradesForUser, upsertGrade };

'use strict';

const db = require('../config/db');
const { ROLES } = require('../utils/constants');
const { badRequest, notFound, forbidden, conflict } = require('../utils/errors');

const listAllCoursesStmt = db.prepare(`
  SELECT c.id, c.codigo, c.nombre, c.descripcion, c.active, c.created_at,
         c.profesor_id, COALESCE(p.name, '') AS profesor_nombre,
         (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id) AS inscritos
  FROM cursos c
  LEFT JOIN users p ON p.id = c.profesor_id
  ORDER BY c.id ASC
`);
const listProfessorCoursesStmt = db.prepare(`
  SELECT c.id, c.codigo, c.nombre, c.descripcion, c.active, c.created_at, c.profesor_id,
         (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id) AS inscritos
  FROM cursos c
  WHERE c.profesor_id = @profesor_id
  ORDER BY c.id ASC
`);
const listStudentCoursesStmt = db.prepare(`
  SELECT c.id, c.codigo, c.nombre, c.descripcion, c.active, c.created_at, c.profesor_id,
         COALESCE(p.name, '') AS profesor_nombre,
         n.valor AS nota
  FROM inscripciones i
  JOIN cursos c ON c.id = i.curso_id
  LEFT JOIN users p ON p.id = c.profesor_id
  LEFT JOIN notas n ON n.curso_id = c.id AND n.estudiante_id = i.estudiante_id
  WHERE i.estudiante_id = @estudiante_id
  ORDER BY c.id ASC
`);
const findCourseStmt = db.prepare('SELECT * FROM cursos WHERE id = ?');
const insertCourseStmt = db.prepare(
  'INSERT INTO cursos (codigo, nombre, descripcion, profesor_id) VALUES (@codigo, @nombre, @descripcion, @profesor_id)'
);
const updateCourseStmt = db.prepare(`
  UPDATE cursos SET
    codigo = COALESCE(@codigo, codigo),
    nombre = COALESCE(@nombre, nombre),
    descripcion = COALESCE(@descripcion, descripcion),
    profesor_id = COALESCE(@profesor_id, profesor_id),
    active = COALESCE(@active, active)
  WHERE id = @id
`);
const deleteCourseStmt = db.prepare('DELETE FROM cursos WHERE id = @id');
const insertEnrollStmt = db.prepare(
  'INSERT INTO inscripciones (curso_id, estudiante_id) VALUES (@curso_id, @estudiante_id)'
);
const listStudentsStmt = db.prepare(`
  SELECT u.id, u.name, u.email, u.active, i.created_at AS inscrito_el,
         n.valor AS nota
  FROM inscripciones i
  JOIN users u ON u.id = i.estudiante_id
  LEFT JOIN notas n ON n.curso_id = i.curso_id AND n.estudiante_id = i.estudiante_id
  WHERE i.curso_id = @curso_id
  ORDER BY u.name ASC
`);
const userRoleStmt = db.prepare('SELECT role, active FROM users WHERE id = ?');

// Lista de cursos segun el rol de la sesion (control de acceso en origen de datos).
function listCoursesForUser(user) {
  if (user.role === ROLES.ADMIN) return listAllCoursesStmt.all();
  if (user.role === ROLES.PROFESOR) return listProfessorCoursesStmt.all({ profesor_id: user.id });
  return listStudentCoursesStmt.all({ estudiante_id: user.id });
}

function getCourse(id) {
  const c = findCourseStmt.get(id);
  if (!c) throw notFound('Curso no encontrado');
  return c;
}

// [E5.2: anti-IDOR] El profesor en sesión debe ser dueño del curso; si no, 403
// aunque adivine el id (ver smoke test "profesor NO puede ver...").
function assertProfessorOwnsCourse(user, course) {
  if (course.profesor_id !== user.id) {
    throw forbidden('No autorizado');
  }
}

function createCourse({ codigo, nombre, descripcion, profesorId }) {
  const info = insertCourseStmt.run({
    codigo,
    nombre,
    descripcion: descripcion || null,
    profesor_id: profesorId || null,
  });
  return findCourseStmt.get(info.lastInsertRowid);
}

function updateCourse(id, { codigo, nombre, descripcion, profesorId, active }) {
  const existing = findCourseStmt.get(id);
  if (!existing) throw notFound('Curso no encontrado');
  updateCourseStmt.run({
    id,
    codigo: codigo || null,
    nombre: nombre || null,
    descripcion: descripcion === undefined ? null : descripcion,
    profesor_id: profesorId === undefined ? null : profesorId,
    active: active === undefined ? null : (active ? 1 : 0),
  });
  return findCourseStmt.get(id);
}

function deleteCourse(id) {
  const existing = findCourseStmt.get(id);
  if (!existing) throw notFound('Curso no encontrado');
  deleteCourseStmt.run({ id });
}

function enrollStudent(courseId, studentId) {
  const course = findCourseStmt.get(courseId);
  if (!course) throw notFound('Curso no encontrado');
  const student = userRoleStmt.get(studentId);
  if (!student) throw notFound('Estudiante no encontrado');
  if (student.role !== ROLES.ESTUDIANTE) throw badRequest('El usuario no es estudiante.');

  try {
    insertEnrollStmt.run({ curso_id: courseId, estudiante_id: studentId });
  } catch (err) {
    // Violacion de UNIQUE(curso_id, estudiante_id).
    throw conflict('El estudiante ya esta inscrito en este curso.');
  }
}

// Solo profesor (dueno) y admin pueden ver el listado de estudiantes.
function listEnrolledStudents(courseId, user) {
  const course = findCourseStmt.get(courseId);
  if (!course) throw notFound('Curso no encontrado');
  if (user.role === ROLES.PROFESOR) {
    assertProfessorOwnsCourse(user, course);
  } else if (user.role !== ROLES.ADMIN) {
    throw forbidden('No autorizado');
  }
  return { course, students: listStudentsStmt.all({ curso_id: courseId }) };
}

module.exports = {
  listCoursesForUser,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollStudent,
  listEnrolledStudents,
  assertProfessorOwnsCourse,
};

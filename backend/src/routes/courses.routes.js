'use strict';

const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES, ACTIONS, RESULT } = require('../utils/constants');
const { createCourseSchema, updateCourseSchema, enrollSchema, courseIdParamSchema } = require('../schemas');
const courseService = require('../services/course.service');
const { auditFromReq } = require('../services/audit.service');

const router = express.Router();

// Todas las rutas requieren sesion.
router.use(requireAuth);

// GET /api/courses -> cursos segun el rol de la sesion.
router.get('/', (req, res) => {
  const courses = courseService.listCoursesForUser(req.user);
  res.json({ courses });
});

// POST /api/courses (solo admin)
router.post('/', requireRole(ROLES.ADMIN), validate(createCourseSchema), (req, res) => {
  const course = courseService.createCourse(req.body);
  auditFromReq(req, ACTIONS.COURSE_CREATE, 'curso', course.id, RESULT.SUCCESS);
  res.status(201).json({ course });
});

// PATCH /api/courses/:id (solo admin)
router.patch('/:id', requireRole(ROLES.ADMIN), validate(updateCourseSchema), (req, res) => {
  const course = courseService.updateCourse(req.params.id, req.body);
  auditFromReq(req, ACTIONS.COURSE_UPDATE, 'curso', course.id, RESULT.SUCCESS);
  res.json({ course });
});

// DELETE /api/courses/:id (solo admin)
router.delete('/:id', requireRole(ROLES.ADMIN), validate(courseIdParamSchema), (req, res) => {
  courseService.deleteCourse(req.params.id);
  auditFromReq(req, ACTIONS.COURSE_DELETE, 'curso', req.params.id, RESULT.SUCCESS);
  res.json({ ok: true });
});

// POST /api/courses/:id/enroll (solo admin)
router.post('/:id/enroll', requireRole(ROLES.ADMIN), validate(enrollSchema), (req, res) => {
  courseService.enrollStudent(req.params.id, req.body.studentId);
  auditFromReq(req, ACTIONS.ENROLL, 'inscripcion', `${req.params.id}:${req.body.studentId}`, RESULT.SUCCESS);
  res.status(201).json({ ok: true });
});

// GET /api/courses/:id/students (admin o profesor dueno del curso)
router.get('/:id/students', requireRole(ROLES.ADMIN, ROLES.PROFESOR), validate(courseIdParamSchema), (req, res) => {
  const data = courseService.listEnrolledStudents(req.params.id, req.user);
  res.json(data);
});

module.exports = router;

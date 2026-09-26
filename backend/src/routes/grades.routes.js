'use strict';

const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES, ACTIONS, RESULT } = require('../utils/constants');
const { upsertGradeSchema } = require('../schemas');
const gradeService = require('../services/grade.service');
const { auditFromReq } = require('../services/audit.service');

const router = express.Router();

router.use(requireAuth);

// GET /api/grades -> notas segun el rol de la sesion (estudiante solo las suyas).
router.get('/', (req, res) => {
  const grades = gradeService.listGradesForUser(req.user);
  res.json({ grades });
});

// PUT /api/grades/:courseId -> crear/editar nota (admin o profesor dueno del curso).
router.put('/:id', requireRole(ROLES.ADMIN, ROLES.PROFESOR), validate(upsertGradeSchema), (req, res) => {
  const grade = gradeService.upsertGrade(req.params.id, req.body, req.user);
  auditFromReq(req, ACTIONS.GRADE_UPSERT, 'nota', `${grade.curso_id}:${grade.estudiante_id}`, RESULT.SUCCESS);
  res.json({ grade });
});

module.exports = router;

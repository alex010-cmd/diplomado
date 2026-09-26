'use strict';

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const auditService = require('../services/audit.service');

const router = express.Router();

// Visor de auditoria: solo administradores.
router.use(requireAuth, requireRole(ROLES.ADMIN));

// GET /api/audit?limit=&offset=&action=&userId=
router.get('/', (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 200, 500);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  const data = auditService.listAudit({
    limit,
    offset,
    userId: req.query.userId ? Number(req.query.userId) : null,
    action: req.query.action || null,
  });
  res.json(data);
});

module.exports = router;

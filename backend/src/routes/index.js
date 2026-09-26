'use strict';

const express = require('express');

const { createAuthRouter } = require('./auth.routes');
const { createUsersRouter } = require('./users.routes');
const coursesRoutes = require('./courses.routes');
const gradesRoutes = require('./grades.routes');
const auditRoutes = require('./audit.routes');

// Fabrica del router API: cablea los limitadores instanciados por createApp
// para que cada aplicacion tenga contadores independientes.
function createApiRouter({ loginRateLimiter, searchRateLimiter }) {
  const router = express.Router();

  // Endpoint publico de health check (sin autenticacion).
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  router.use('/auth', createAuthRouter({ loginRateLimiter }));
  router.use('/users', createUsersRouter({ searchRateLimiter }));
  router.use('/courses', coursesRoutes);
  router.use('/grades', gradesRoutes);
  router.use('/audit', auditRoutes);

  return router;
}

module.exports = { createApiRouter };

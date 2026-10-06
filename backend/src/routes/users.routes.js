'use strict';

const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES, ACTIONS, RESULT } = require('../utils/constants');
const { createUserSchema, updateUserSchema, userSearchSchema, idParam } = require('../schemas');
const { z } = require('zod');
const userService = require('../services/user.service');
const { auditFromReq } = require('../services/audit.service');

const userIdParamSchema = z.object({ params: idParam });

// Fabrica: recibe el limitador de busquedas ya instanciado.
function createUsersRouter({ searchRateLimiter }) {
  const router = express.Router();

  // Todas las rutas de usuarios requieren sesion de administrador.
  router.use(requireAuth, requireRole(ROLES.ADMIN));

  // [E5.2: API segura + E5.1: validación de formato] RBAC admin, rate limit de
  // búsquedas, esquema zod (longitud/caracteres) y prepared statement en servicio.
  // GET /api/users?search=... (busqueda con rate limit 30/min)
  router.get('/', searchRateLimiter, validate(userSearchSchema), (req, res) => {
    const search = req.query.search || '';
    const data = userService.listUsers({ search, limit: 200, offset: 0 });
    res.json(data);
  });

  // POST /api/users (crear usuario con cualquier rol)
  router.post('/', validate(createUserSchema), (req, res) => {
    const user = userService.createUser(req.body);
    auditFromReq(req, ACTIONS.USER_CREATE, 'user', user.id, RESULT.SUCCESS);
    res.status(201).json({ user });
  });

  // GET /api/users/:id
  router.get('/:id', validate(userIdParamSchema), (req, res) => {
    const user = userService.getUserById(req.params.id);
    res.json({ user });
  });

  // PATCH /api/users/:id (cambiar rol / activar-desactivar)
  router.patch('/:id', validate(updateUserSchema), (req, res) => {
    const user = userService.updateUser(req.params.id, req.body, req.user);
    auditFromReq(req, ACTIONS.USER_UPDATE, 'user', user.id, RESULT.SUCCESS);
    res.json({ user });
  });

  return router;
}

module.exports = { createUsersRouter };

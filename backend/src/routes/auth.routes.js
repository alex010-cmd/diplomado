'use strict';

const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { loginSchema, registerSchema } = require('../schemas');
const authService = require('../services/auth.service');

// Fabrica: recibe el limitador de login ya instanciado para que cada
// aplicacion (prod, tests) tenga su propio contador.
function createAuthRouter({ loginRateLimiter }) {
  const router = express.Router();

  // POST /api/auth/register (publico, crea estudiante)
  router.post('/register', validate(registerSchema), (req, res) => {
    const user = authService.register(req.body);
    res.status(201).json({ user });
  });

  // POST /api/auth/login (publico, con rate limit 5/min)
  router.post('/login', loginRateLimiter, validate(loginSchema), (req, res) => {
    const user = authService.login(req.body, req, res);
    res.json({ user });
  });

  // POST /api/auth/refresh (publico, rotacion de refresh token)
  router.post('/refresh', (req, res) => {
    const user = authService.refresh(req, res);
    res.json({ user });
  });

  // POST /api/auth/logout (revoca refresh token y limpia cookies)
  router.post('/logout', (req, res) => {
    authService.logout(req, res);
    res.json({ ok: true });
  });

  // GET /api/auth/me (informacion de la sesion actual)
  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: authService.findById(req.user.id) });
  });

  return router;
}

module.exports = { createAuthRouter };

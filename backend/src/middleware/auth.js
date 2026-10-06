'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { COOKIES } = require('../utils/constants');
const { auditFromReq } = require('../services/audit.service');
const { ACTIONS, RESULT } = require('../utils/constants');

/**
 * [E5.2: control de acceso por rol + anti-IDOR] Exige access token en cookie
 * httpOnly. El id/rol derivan EXCLUSIVAMENTE del token, nunca del cuerpo/query;
 * requireRole cierra cada endpoint al rol mínimo necesario.
 */
function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIES.ACCESS] : undefined;
  if (!token) {
    auditFromReq(req, ACTIONS.ACCESS_DENIED, 'session', null, RESULT.DENIED);
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      name: payload.name,
      email: payload.email,
    };
    return next();
  } catch (err) {
    auditFromReq(req, ACTIONS.ACCESS_DENIED, 'session', null, RESULT.DENIED);
    return res.status(401).json({ error: 'No autorizado' });
  }
}

// Control de acceso por rol (RBAC).
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      auditFromReq(req, ACTIONS.ACCESS_DENIED, 'forbidden', null, RESULT.DENIED);
      return res.status(403).json({ error: 'No autorizado' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };

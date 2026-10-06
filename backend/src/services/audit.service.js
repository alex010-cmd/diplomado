'use strict';

const db = require('../config/db');
const { RESULT } = require('../utils/constants');
const logger = require('../utils/logger');

// Prepared statement (nunca SQL por concatenacion).
const insertStmt = db.prepare(`
  INSERT INTO audit_log (user_id, action, entity, entity_id, result, ip, user_agent)
  VALUES (@user_id, @action, @entity, @entity_id, @result, @ip, @user_agent)
`);

/**
 * [E5.2: auditoría y logs + Fase 5 AuditLog] Registra logins, denegaciones y
 * cambios sensibles con user_id, IP, user-agent, acción, entidad y resultado.
 * Nunca incluye contrasenas ni tokens. Un fallo aquí jamas rompe la app.
 */
function logAudit({ userId = null, action, entity = null, entityId = null, result = RESULT.SUCCESS, ip = null, userAgent = null }) {
  try {
    insertStmt.run({
      user_id: userId,
      action,
      entity,
      entity_id: entityId == null ? null : String(entityId),
      result,
      ip: ip ? String(ip).slice(0, 64) : null,
      user_agent: userAgent ? String(userAgent).slice(0, 255) : null,
    });
  } catch (err) {
    logger.error({ err, action }, 'fallo al escribir audit_log');
  }
}

// Comodidad: construye el evento a partir de la request (id de sesion, ip, user-agent).
function auditFromReq(req, action, entity = null, entityId = null, result = RESULT.SUCCESS) {
  logAudit({
    userId: req.user ? req.user.id : null,
    action,
    entity,
    entityId,
    result,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
}

function listAudit({ limit = 200, offset = 0, userId = null, action = null }) {
  const where = [];
  const params = {};
  if (userId) {
    where.push('user_id = @user_id');
    params.user_id = userId;
  }
  if (action) {
    where.push('action = @action');
    params.action = action;
  }
  // nosemgrep: no-sql-concatenation -- Falso positivo justificado: `where` solo
  // contiene fragmentos SQL estaticos definidos en el codigo; los valores se
  // enlazan siempre mediante parametros nombrados (@user_id, @action).
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `
    SELECT a.id, a.user_id, u.email AS user_email, a.action, a.entity, a.entity_id,
           a.result, a.ip, a.user_agent, a.created_at
    FROM audit_log a
    LEFT JOIN users u ON u.id = a.user_id
    ${whereSql}
    ORDER BY a.id DESC
    LIMIT @limit OFFSET @offset
  `;
  const rows = db.prepare(sql).all({ ...params, limit, offset });
  const countSql = `SELECT COUNT(*) AS c FROM audit_log a ${whereSql}`;
  const total = db.prepare(countSql).get({ ...params }).c;
  return { rows, total };
}

module.exports = { logAudit, auditFromReq, listAudit };

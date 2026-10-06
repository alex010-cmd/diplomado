# Ejercicio 5.2 — Mapa requisito → código

Cada punto del proyecto integrador y dónde está implementado (busca las notas
`[E5.2: ...]` en el código). El Ejercicio 5.1 vive en `docs/ejercicio-5-1/`.

## Definición (arquitectura + alcance)

| Requisito | Evidencia |
|---|---|
| Registro/login, búsqueda con datos sensibles, admin con RBAC | `backend/src/routes/*.js`, `backend/public/*.html` |
| Arquitectura front/back/BD | `docs/arquitectura.md` |

## Modelado de amenazas (DFD + STRIDE ≥ 8 filas)

| Requisito | Evidencia |
|---|---|
| DFD nivel 0 y 1 (Mermaid) + tabla STRIDE de 12 filas | `docs/dfd-stride.md` |

## Inyección y validación

| Requisito | Evidencia |
|---|---|
| 100% prepared statements (prohibida la concatenación) | `backend/src/services/*.js`, `backend/src/db/schema.sql`; demo antes/después en `docs/ejercicio-5-1/` |
| Validación en servidor (zod por endpoint) | `backend/src/schemas.js`, `backend/src/middleware/validate.js` |
| Validación en cliente (espejo) | `backend/public/js/validation.js`, `login.js`, `register.js` |

## Autenticación y control de acceso

| Requisito | Evidencia |
|---|---|
| bcrypt cost 12 | `backend/src/utils/crypto.js :: hashPassword` |
| JWT corto (15 min) + refresh rotativo (7 días), cookies httpOnly/SameSite/Secure | `backend/src/utils/jwt.js`, `utils/http.js`, `services/auth.service.js` |
| RBAC + anti-IDOR (filtrar por id de sesión) | `middleware/auth.js`, `services/grade.service.js`, `services/course.service.js` |
| Errores genéricos + tiempo constante anti-enumeración | `services/auth.service.js :: login`, `middleware/errorHandler.js` |

## Errores y configuración

| Requisito | Evidencia |
|---|---|
| Detalle solo en desarrollo, handler centralizado, 404 JSON | `middleware/errorHandler.js` |
| CSP estricta, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HTTPS forzado | `middleware/security.js`, `src/app.js`, `config/env.js` |

## Seguridad en la API

| Requisito | Evidencia |
|---|---|
| CORS whitelist + verificación de Origin (anti-CSRF) | `middleware/security.js` |
| Rate limiting login 5/min, búsquedas 30/min, global 100/min | `middleware/security.js` |
| Auth obligatoria salvo login/registro/health | `routes/*.js` (`requireAuth`) |

## Auditoría y logs

| Requisito | Evidencia |
|---|---|
| Login OK/KO, 401/403, cambios sensibles, operaciones admin (sin secretos) | `services/audit.service.js`, tabla `audit_log`, visor en `public/js/admin.js` |
| Logs de servidor con redacción | `utils/logger.js` (pino + `redact`) |

## Verificación (SAST/DAST + antes/después)

| Requisito | Evidencia |
|---|---|
| Semgrep con reglas propias | `tools/semgrep.yaml`, `npm run sast` |
| OWASP ZAP baseline | `tools/run-zap.sh`, `npm run zap` |
| Reporte antes/después + smoke tests de seguridad | `docs/verificacion.md`, `backend/test/smoke.test.js` |

## Demo en vivo sugerida (10 min)

1. `node docs/ejercicio-5-1/probar-inyeccion.js` → SQLi bloqueada (E5.1).
2. Login `admin@universidad.edu` / `Admin123` → pestaña Auditoría con los eventos.
3. Como `ana`, `PUT /api/grades/1` en DevTools → 403 (anti-IDOR).

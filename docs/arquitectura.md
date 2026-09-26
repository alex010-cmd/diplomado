# Arquitectura y decisiones de diseño

Proyecto final de ciberseguridad: **Portal académico de gestión de notas** con
seguridad incorporada desde el diseño (AppSec / SSDLC).

## 1. Visión general

Monorepo con tres capas:

```
┌─────────────┐      HTTPS/cookies httpOnly      ┌──────────────┐      prepared       ┌───────────┐
│  Frontend   │  ─────────────────────────────▶  │   Backend    │  ───────────────▶  │  SQLite   │
│ HTML+CSS+JS │  ◀─────────────────────────────  │ Node+Express │  ◀───────────────  │ better-   │
│  (estático) │        JSON (sin datos sensibles)│     5        │   statements      │ sqlite3   │
└─────────────┘                                  └──────────────┘                     └───────────┘
```

- **Frontend** (`backend/public/`): HTML5 + CSS3 + JavaScript vanilla, servido
  como archivos estáticos por Express. Sin frameworks, sin scripts ni estilos
  inline, sin `onclick` en HTML (compatible con CSP `default-src 'self'`).
- **Backend** (`backend/src/`): Node.js + Express 5 (CommonJS), organizado en
  `config/`, `db/`, `middleware/`, `routes/`, `services/`, `utils/`.
- **Base de datos** (`backend/data/app.db`): SQLite con `better-sqlite3`.
  Acceso **exclusivamente** mediante prepared statements con parámetros
  (`?` o `@nombre`). Prohibida la concatenación de SQL.

## 2. Modelo de datos

Tablas (ver `backend/src/db/schema.sql`): `users`, `refresh_tokens`, `cursos`,
`inscripciones`, `notas`, `audit_log`. Con claves foráneas, índices y
restricciones (`CHECK`, `UNIQUE`).

## 3. Decisiones de diseño de seguridad

| Decisión | Justificación | Archivo(s) |
|---|---|---|
| bcrypt cost 12 para contraseñas | OWASP recomienda coste adaptativo alto; 12 equilibra seguridad y rendimiento | `utils/crypto.js` |
| JWT acceso 15 min + refresh rotativo 7 días | Ventana de exposición corta; rotación limita reutilización de tokens robados | `services/auth.service.js`, `utils/jwt.js` |
| Ambos tokens en cookies `httpOnly`, `SameSite=Strict`, `Secure` en prod | Inaccesibles a JS (anti-XSS) y no se envían cross-site (anti-CSRF) | `utils/http.js`, `config/env.js` |
| Refresh tokens **hasheados** (sha-256) en BD | Un volcado de BD no permite suplantar sesiones | `services/auth.service.js`, `db/schema.sql` |
| `requireAuth` + `requireRole` en todas las rutas salvo login/registro/health | Defensa por defecto: denegar salvo autorización explícita | `middleware/auth.js`, `routes/*.js` |
| Anti-IDOR: filtrar **siempre** por el id de sesión | La autorización se deriva del token, nunca de ids enviados por el cliente | `services/grade.service.js`, `services/course.service.js` |
| Validación zod en servidor + validación espejo en cliente | El servidor es la frontera de confianza; el cliente mejora UX | `schemas.js`, `public/js/validation.js` |
| Helmet con CSP estricta (`default-src 'self'`, sin `unsafe-inline`) | Mitiga XSS; fuerza scripts/estilos externos | `middleware/security.js` |
| CORS con whitelist + verificación de `Origin` en métodos mutantes | Defensa en profundidad anti-CSRF junto a `SameSite=Strict` | `middleware/security.js` |
| Rate limiting (global 100/min, login 5/min, búsquedas 30/min) | Mitiga fuerza bruta y enumeración/abuso | `middleware/security.js` |
| Errores genéricos al cliente, detalle solo en desarrollo | No filtrar información (usuarios existentes, stack traces) | `middleware/errorHandler.js` |
| Auditoría en BD (`audit_log`) + pino en servidor | Trazabilidad de accesos, denegaciones y cambios sensibles | `services/audit.service.js`, `utils/logger.js` |
| `escapeHtml` en todo renderizado de datos del servidor | Previene XSS almacenado en el frontend | `public/js/api.js` |
| Respuesta en tiempo constante en login (hash dummy) | Evita enumeración de usuarios por timing | `services/auth.service.js`, `utils/crypto.js` |

## 4. Flujo de autenticación

1. `POST /api/auth/login` → verifica bcrypt → emite access JWT (15 min) y
   refresh token (7 días, hasheado en BD) → ambos en cookies `httpOnly`.
2. Cada petición protegida envía la cookie automáticamente; `requireAuth`
   verifica el JWT y fija `req.user = { id, role, ... }`.
3. `POST /api/auth/refresh` → valida el refresh, **revoca el usado** y emite
   un par nuevo (rotación).
4. `POST /api/auth/logout` → revoca el refresh y limpia cookies.

## 5. Configuración

Variables de entorno vía `dotenv` (ver `.env.example`). En producción se exige
definir secretos JWT propios, `COOKIE_SECURE=true` y HTTPS (HSTS + redirect).

# Portal Académico Seguro — Proyecto final de ciberseguridad

Portal de gestión de notas con **seguridad desde el diseño** (AppSec):
autenticación robusta, RBAC, anti-IDOR, validación, auditoría y cabeceras HTTP
estrictas. Stack: Node.js + Express 5, SQLite (`better-sqlite3`), HTML/CSS/JS
vanilla, bcrypt (cost 12), JWT + refresh rotativo en cookies `httpOnly`.

Roles: **admin** (usuarios, cursos, inscripciones, auditoría), **profesor**
(sus cursos, estudiantes y notas), **estudiante** (solo sus cursos y notas).

## Instalación

```bash
npm install        # instala dependencias
cp .env.example .env
npm run seed       # crea la BD y los usuarios/cursos/notas de prueba
npm start          # http://localhost:3000
npm run dev        # modo desarrollo (auto-reload)
```

## Variables de entorno

Ver `.env.example`. Las relevantes: `PORT`, `DATABASE_PATH`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL=15m`,
`REFRESH_TOKEN_TTL=7d`, `BCRYPT_COST=12`, `COOKIE_SECURE` (true en prod con
HTTPS), `CORS_ORIGINS`, `TRUST_PROXY`. En producción la app **falla al
arrancar** si no se definen secretos JWT propios.

## Usuarios de prueba (tras `npm run seed`)

| Rol | Email | Contraseña |
|---|---|---|
| admin | admin@universidad.edu | Admin123 |
| profesor | prof.garcia@universidad.edu | Profesor123 |
| profesor | prof.lopez@universidad.edu | Profesor123 |
| estudiante | ana@universidad.edu | Estudiante123 |
| estudiante | luis@universidad.edu | Estudiante123 |
| estudiante | maria@universidad.edu | Estudiante123 |

## Verificación

```bash
npm run smoke  # node:test: login, genéricos, IDOR→403, validación, rate limit
npm run sast   # Semgrep (requiere semgrep local o Docker)
npm run zap    # OWASP ZAP baseline (requiere Docker + app corriendo)
```

Documentación: `docs/arquitectura.md`, `docs/dfd-stride.md`,
`docs/verificacion.md` (reporte SAST/DAST antes/después).

## Ejercicios Bloque 05 (trazabilidad en el código)

- **E5.1** (SQLi antes/después + SP + PoC ejecutable): `docs/ejercicio-5-1/`
  — `node docs/ejercicio-5-1/probar-inyeccion.js`.
- **E5.2** (mapa requisito → archivo): `docs/ejercicio-5-2-mapa.md`.
- En el código, cada mecanismo lleva su nota (`[E5.1: ...]` / `[E5.2: ...]`)
  explicando qué punto del ejercicio cubre y dónde ver la evidencia.

## Guion de presentación oral (10 minutos)

1. **(1 min) Contexto.** Portal de notas con 3 roles; la seguridad se diseñó
   antes que el código (mostrar `docs/dfd-stride.md`: DFD + tabla STRIDE).
2. **(2 min) Arquitectura.** Recorrer `docs/arquitectura.md`: prepared
   statements, bcrypt cost 12, JWT 15 min + refresh rotativo en cookies
   `httpOnly`/`SameSite=Strict`, helmet + CSP sin `unsafe-inline`.
3. **(2 min) Demo 1 — SQLi bloqueada.** En login, probar usuario
   `' OR '1'='1` → la app responde "Credenciales inválidas" (401). Explicar:
   prepared statements (`services/auth.service.js`) + mensaje genérico que no
   revela si el usuario existe (+ hash dummy en tiempo constante).
4. **(2 min) Demo 2 — IDOR bloqueado.** Como `ana`, abrir DevTools y pedir
   `GET /api/courses/1/students` o `PUT /api/grades/1` → **403**. Explicar:
   los datos se filtran por el id de la sesión (`req.user.id`), nunca por lo
   que envía el cliente (`services/grade.service.js`, `middleware/auth.js`).
5. **(1 min) Demo 3 — Rate limit.** Repetir login fallido 6 veces → la 6.ª
   devuelve **429**. Mostrar `middleware/security.js` (login 5/min).
6. **(1 min) Auditoría en vivo.** Como admin, abrir la pestaña Auditoría y
   mostrar los `login_failure`, `access_denied` y `grade_upsert` generados en
   las demos (ver `services/audit.service.js`, tabla `audit_log`).
7. **(1 min) Verificación.** `npm run smoke` en verde y `npm run sast`;
   plantilla antes/después en `docs/verificacion.md`. Cierre: seguridad como
   requisito, no como parche.

# Solución Web Distribuida en AWS — Frontend + Backend

Carpeta única con los 2 proyectos dockerizados.
Tú te encargas de redes/servidores; aquí está el código + guía de despliegue.

```
solucion-web-distribuida-aws/
├── frontend/   # React + Vite (Node 20) → VPS FRONT (VPC Frontend)
│   ├── src/ (components, pages, services, context)
│   ├── Dockerfile (build Node → serve Nginx)
│   └── nginx.conf (cabeceras SecurityHeaders.com)
├── backend/    # FastAPI hexagonal → VPS BACK (VPC Backend)
│   ├── app/domain/ (entidades puras)
│   ├── app/application/ (casos de uso)
│   ├── app/infrastructure/ (JWT, repo, rate-limit)
│   ├── app/api/ (FastAPI: auth + dashboard)
│   ├── fail2ban/ (jail.local + filtro)
│   └── Dockerfile
└── README.md
```

Stack: **React (Node.js) + FastAPI**. El front usa Node solo para compilar; en producción sirve con Nginx. El back es Python FastAPI.

## 1. Credenciales demo
- Usuario: `admin` / Contrasena: `Admin123*`
- Login: `POST /api/auth/login` → `{access_token, ...}`
- Protegido: `GET /api/dashboard` con `Authorization: Bearer <JWT>`

## 2. Despliegue por VPS

### VPS BACK (VPC Backend, privada)
```bash
cd backend
cp .env.example .env  # ajusta FRONTEND_ORIGIN a tu dominio HTTPS
docker build -t backend:v1 .
docker run -d --name backend -p 8000:8000 --env-file .env backend:v1
# prueba privada:
curl http://localhost:8000/api/health
```

### VPS FRONT (VPC Frontend, pública 80/443)
```bash
cd frontend
# Si usas peering: VITE_API_URL=http://10.x.x.x:8000 (IP privada del back)
# Si usas dominio: VITE_API_URL=https://tu-dominio.com
docker build --build-arg VITE_API_URL=http://10.1.0.10:8000 -t frontend:v1 .
docker run -d --name frontend -p 80:80 frontend:v1
```

## 3. Redes (lo haces tú manual)
- 2 VPC: Frontend y Backend + **VPC Peering**.
- Tablas de ruta: cada VPC con ruta al CIDR de la otra vía `pcx-xxxx`.
- SG Backend: solo `TCP 8000` desde `CIDR VPC-Frontend` (no 0.0.0.0/0).
- SG Frontend: `80/443` desde internet, salida a peering.
- Evidencia: `ping` + `curl http://<IP-privada-back>:8000/api/health` desde VPS Front.

## 4. HTTPS con Certbot (VPS Front)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d tu-dominio.com
# verifica: https://tu-dominio.com y candado en login (creds cifradas)
```

## 5. Fail2Ban (VPS Back)
```bash
sudo apt install fail2ban -y
sudo cp fail2ban/jail.local /etc/fail2ban/jail.d/backend.conf
sudo cp fail2ban/filter-backend-fastapi.conf /etc/fail2ban/filter.d/backend-fastapi.conf
# asegura que uvicorn loguee a /var/log/backend/uvicorn.log
sudo systemctl restart fail2ban
# prueba: 6 logins malos → `sudo fail2ban-client status backend-fastapi` muestra IP baneada
# además la app responde 429 (rate-limit interno)
```

## 6. SecurityHeaders.com
Ya van cabeceras en `backend/app/main.py` y `frontend/nginx.conf`:
`X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS, CSP`.
Escanea tu dominio HTTPS y captura el grade (objetivo A).

## 7. Pruebas mínimas
1. `curl` health entre VPC (peering OK)
2. Abrir front, login OK → dashboard con KPIs
3. Sin JWT → 401 en `/api/dashboard`
4. HTTPS válido + login via https (devtools: 443)
5. 6 fallos → 429 + `fail2ban-client status`
---

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

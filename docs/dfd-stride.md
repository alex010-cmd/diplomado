# Modelado de amenazas: DFD + STRIDE

## 1. DFD Nivel 0 (contexto)

```mermaid
flowchart LR
    subgraph Actores
        A[Admin]
        P[Profesor]
        E[Estudiante]
        AT[Atacante]
    end
    subgraph Portal["Portal Académico (límite de confianza)"]
        W[App Web<br/>Frontend + API + BD]
    end
    A -->|gestiona usuarios/cursos/auditoría| W
    P -->|consulta cursos / edita notas| W
    E -->|consulta sus cursos y notas| W
    AT -.->|intenta SQLi, IDOR, fuerza bruta, XSS, CSRF| W
    W -->|logs| L[(audit_log + pino)]
```

Frontera de confianza: el navegador es **no confiable**; toda validación y
autorización ocurre en el servidor. La BD solo acepta prepared statements.

## 2. DFD Nivel 1 (procesos y almacenes)

```mermaid
flowchart TD
    B[Navegador<br/>HTML/CSS/JS externo] -->|1. HTTPS + cookies httpOnly| API[2. API Express<br/>helmet, CORS, rate-limit, validación zod]
    API -->|3. JWT access 15min<br/>requireAuth/requireRole| AUTH[P3. Auth Service<br/>bcrypt + rotación refresh]
    API --> P4[P4. Servicios<br/>users / cursos / notas]
    AUTH -->|hash sha-256| RT[(refresh_tokens)]
    AUTH --> U[(users)]
    P4 --> U
    P4 --> C[(cursos)]
    P4 --> I[(inscripciones)]
    P4 --> N[(notas)]
    API -->|4. eventos| AL[(audit_log)]
    API -->|5. pino| LOG[Servidor de logs]
```

Flujos de datos sensibles (notas, datos personales) siempre filtrados por el
id de sesión del token (`req.user.id`); el cliente nunca decide a qué datos
accede.

## 3. Tabla STRIDE (mínimo 8 amenazas)

| # | Activo | Amenaza | Categoría STRIDE | Contramedida planificada | Archivo(s) |
|---|---|---|---|---|---|
| 1 | Credenciales (login) | Fuerza bruta / credential stuffing | D (Denegación) / E | Rate limit 5/min en login; mensajes genéricos; bcrypt cost 12 | `middleware/security.js`, `services/auth.service.js` |
| 2 | Cuentas de usuario | Enumeración (existencia por mensaje o timing) | I (Divulgación) | Mensaje único "Credenciales inválidas"; comparación con hash dummy en tiempo constante | `services/auth.service.js`, `utils/crypto.js` |
| 3 | Base de datos | Inyección SQL en login/búsquedas | T (Manipulación) | 100% prepared statements (`?`/`@`); validación zod; sin concatenación | `db/schema.sql`, `services/*.js`, `schemas.js`, `tools/semgrep.yaml` |
| 4 | Notas de estudiantes | IDOR: leer/editar notas ajenas manipulando ids | E (Elevación) | Filtrar siempre por `req.user.id`; `assertProfessorOwnsCourse`; RBAC | `services/grade.service.js`, `services/course.service.js`, `middleware/auth.js` |
| 5 | Sesiones (JWT/cookies) | Robo de token vía XSS | I / E | Cookies `httpOnly`, `SameSite=Strict`, `Secure` en prod; access de 15 min; refresh rotativo y hasheado | `utils/http.js`, `utils/jwt.js`, `services/auth.service.js` |
| 6 | Sesiones | CSRF en acciones mutantes | S (Suplantación) | `SameSite=Strict` + verificación de `Origin` en POST/PUT/PATCH/DELETE | `middleware/security.js` |
| 7 | Frontend | XSS almacenado (nombres, descripciones) | T | CSP `default-src 'self'` sin `unsafe-inline`; `escapeHtml` en todo render | `middleware/security.js`, `public/js/api.js` |
| 8 | API | Abuso de búsquedas / scraping de datos sensibles | D | Rate limit 30/min en búsquedas; autenticación obligatoria | `middleware/security.js`, `routes/users.routes.js` |
| 9 | Configuración | Secretos por defecto / HTTP en producción | I | Validación de env (falla en prod sin secretos); HSTS; redirect a HTTPS; `Secure` | `config/env.js`, `src/app.js` |
| 10 | Trazabilidad | Repudio de acciones (admin niega cambios) | R (Repudio) | `audit_log` con user_id, IP, user-agent, acción, entidad, resultado + pino | `services/audit.service.js`, `db/schema.sql` |
| 11 | Errores | Fuga de información (stack, usuarios existentes) | I | Handler centralizado; genéricos en prod; 404 JSON | `middleware/errorHandler.js` |
| 12 | Contraseñas en reposo | Volcado de BD expone credenciales/sesiones | I | bcrypt cost 12; refresh solo como hash sha-256; nunca `password_hash` en JSON | `utils/crypto.js`, `services/auth.service.js` |

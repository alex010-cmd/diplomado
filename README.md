# Solución Web Distribuida en AWS — Mini-Market (Frontend + Backend + Postgres)

> **Despliegue separado (2 VPS):** cada carpeta se clona y corre sola.
> - **VPS 1 Front:** `git clone <repo-front> && cd frontend && ./start.sh http://10.0.128.10:8000`
> - **VPS 2 Back:** `git clone <repo-back> && cd backend && cp .env.example .env && nano .env && ./start.sh`
> - Ver `frontend/README.md` y `backend/README.md` (ahí está qué IP va en cada lado).

```
solucion-web-distribuida-aws/
├── frontend/   # React + Vite (Node 20) → VPS FRONT (VPC Frontend)
│   ├── src/ (components, pages, services, context)
│   ├── Dockerfile (build Node → serve Nginx) + nginx.conf (cabeceras)
├── backend/    # FastAPI hexagonal → VPS BACK (VPC Backend)
│   ├── app/ (domain, application, api, infrastructure, core)
│   ├── db/init.sql (tablas + 23 stored procedures + seed)
│   ├── docker-compose.yml (api + postgres + job db-init)
│   └── fail2ban/ (jail.local + filtro)
└── README.md
```

Stack: **React (Node.js) + FastAPI + Postgres**. Roles: **admin** y **cliente** (+ invitado).

## 1. Reglas del negocio
- Todo acceso a datos es vía **stored procedures** (`sp_*` en `backend/db/init.sql`).
  El rol `pos` solo tiene `EXECUTE`, sin lectura/escritura directa a tablas.
- Limpieza de datos en login y todos los inputs (usuario, correo, SKU, etc.).
- Carrito con **reserva real de stock**: al agregar se aparta, al quitar se
  libera (expira en 30 min). El stock jamás queda en negativo.
- Carrito **persistente y solo con cuenta**: comprar exige login de cliente
  (invitado y admin bloqueados 401/403). Sobrevive a navegar, cerrar sesion
  y recargar (reservas en DB + espejo que ya no se borra al montar).
- Cliente registrado: **15% en su primera compra**. Invitado: sin descuento,
  al pagar se le invita a registrarse. Ticket descargable/imprimible.
- Ticket **en vivo en el carrito**: subtotal, descuentos, **IVA 16%** y total
  (`sp_cart_preview`, sin mover stock). Boton **Pagar fuera del carrito**
  abre el popup del ticket.
- Metodos: efectivo, tarjeta debito/credito, transferencia. Con tarjeta hay
  **alerta obligatoria de pagina de prueba** (checkbox) y la tarjeta **jamas
  va a la DB**: solo ultimos 4 en memoria de la pestana, se borra al recargar.
- Departamentos en DB (`Alimentos y Abarrotes`, `Bebidas y Botanas`,
  `Higiene y Limpieza`, `Lacteos y Frescos`): el admin da de alta en
  popup modal centrado eligiendo departamento + nombre, caracteristicas,
  precio e imagen opcional. Categoria invalida se rechaza en SP.
- El admin **no tiene carrito** (bloqueado 403 en API): solo el cliente
  registrado y el invitado compran.
- Cliente solo ve existencias (`stock > 0`); con 5 o menos ve
  "Últimas (n) piezas" y con 1 "¡Última pieza!".
- Stock < 5 genera **alerta automática al admin** (notificaciones + reabasto
  por clic, sin límite). Admin además crea productos y **descuentos por
  sección o producto** (se combinan con el 15% de primera compra).
- Cuenta: nombre, correo (único), dirección de entrega (engrane),
  historial de compras a su nombre y correo.
- Imagenes **fuera de la DB**: archivos en disco del backend (`/images`,
  volumen Docker), en DB solo la ruta. Upload admin (jpg/png/webp/gif,
  max 2MB, validado por contenido), cuota total 50MB con medidor y aviso
  de "agrega pocas imagenes". URLs externas tambien permitidas.
  Cliente ve carrusel por seccion con imagen/nombre/precio; en el carrito
  la linea lleva miniatura y el precio con descuento se expande al clic
  (desglose sin afectar el total).
- Páginas legales: Política de Privacidad y Términos (footer).

## 2. Credenciales demo
- Admin: `admin / Admin123*`

## 3. Despliegue por VPS

### VPS BACK (VPC Backend, privada `10.0.128.0/17`, EC2 `10.0.128.10`)
```bash
cd backend
cp .env.example .env  # ajusta FRONTEND_ORIGIN a tu dominio HTTPS
docker compose up -d --build
curl http://localhost:8000/api/health  # {"status":"ok"}
```

### VPS FRONT (VPC Frontend, pública `10.0.0.0/17`, EC2 `10.0.0.10`)
```bash
cd frontend
docker build --build-arg VITE_API_URL=http://10.0.128.10:8000 -t frontend:v1 .
docker run -d --name frontend -p 80:80 frontend:v1
```

## 4. Redes (manual)
- 2 VPC + **VPC Peering** (`pcx-xxxx`).
- Tabla Front: `10.0.128.0/17 → pcx-xxxx` + `0.0.0.0/0 → igw`.
- Tabla Back: `10.0.0.0/17 → pcx-xxxx` (sin IGW: back 100% privado).
- SG Front: `80/443 desde 0.0.0.0/0`. SG Back: `8000 solo desde 10.0.0.0/17`.
- Evidencia: desde Front `curl http://10.0.128.10:8000/api/health`.

## 5. HTTPS con Certbot + No-IP (VPS Front)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d tu-host.ddns.net
```
Actualiza Back `.env`: `FRONTEND_ORIGIN=https://tu-host.ddns.net`.

## 6. Fail2Ban (VPS Back)
```bash
sudo apt install fail2ban -y
sudo cp fail2ban/jail.local /etc/fail2ban/jail.d/backend.conf
sudo cp fail2ban/filter-backend-fastapi.conf /etc/fail2ban/filter.d/backend-fastapi.conf
sudo systemctl restart fail2ban
# 6 logins malos → 429 en API + `fail2ban-client status backend-fastapi`
```

## 7. Verificado localmente
- 23 SPs, 30 productos seed, admin con bcrypt real.
- `pos` no puede `SELECT` tablas; sí ejecutar SPs (24 SPs).
- Reserva/apartado, preview = checkout (ej: 2×$20 −10% adm −15% primera
  = base $30.60 + IVA $4.90 = **$35.50**), pago con tarjeta_credito,
  metodo invalido 400, alertas stock<5, login sanitize (400), JWT,
  ticket con IVA/metodo, perfil/password, cabeceras, `npm run build` OK.

## 8. Auditoria de seguridad (skills: OWASP API Top 10, JWT, gitleaks)

Fecha: 2026-10-06. Metodo: escaneo de secretos (detect-secrets) +
revision de codigo + pruebas de ataque en vivo contra stack real.

**Corregido en esta auditoria:**
1. `CORS sin DELETE` (API8): el front eliminaba descuentos con DELETE pero
   el preflight lo bloqueaba. Agregado. Verificado con OPTIONS.
2. `Documentacion expuesta` (API8/API9): `/docs` y `/openapi.json` ahora se
   apagan con `ENABLE_DOCS=False` en produccion. Verificado on/off.
3. `Secreto demo funcional` (detect-secrets: JWT_SECRET, `pos:pos123`, hash
   admin): arranque **denegado** si JWT_SECRET es el de ejemplo (a menos que
   `ALLOW_DEFAULT_JWT=1` local). Verificado: denegado sin secreto, OK con real.
   Rota `pos123`/admin al desplegar.
4. `python-jose sin mantenimiento` → migrado a **PyJWT 2.10.1**.
   Ataques probados y bloqueados (401): `alg:none`, firma ajena, expirado y
   claim `role:admin` forjado en token de cliente (el rol se lee de la DB: 403).
5. `follow_symlink` desactivado en `/images`.

**Verificado que ya estaba bien:** BOLA (tickets/ventas solo propias salvo
admin, SPs con ownership), sin mass assignment (PATCH /me y producto con
campos cerrados, rol no editable), hash nunca expuesto (SPs no lo listan),
rate-limit login + Fail2Ban, SSRF n/a (el servidor nunca descarga la
image_url), upload con extension + bytes magicos + 2MB + cuota + nombres
deterministicos, sin `.svg` (XSS), `pos` sin SELECT directo, errores sin
traza interna.

**Riesgos aceptados (documentados, practica escolar):** JWT en
localStorage (XSS lo leeria; mitigado con CSP `default-src 'self'`),
password min 6, rate-limit en memoria (se reinicia con el contenedor;
Fail2Ban lo complementa), token expirado en checkout opcional degrada a
invitado sin descuento (sin quiebre de autorizacion).

## 9. Pruebas mínimas en AWS
1. Peering: `curl` health entre VPC.
2. Tienda pública, registro con correo, 1ra compra con 15% + ticket.
3. Carrito: agregar/quitar/vaciar mueve el stock; sin JWT no hay dashboard.
4. Admin: alerta stock<5, reabasto por clic, descuento por sección/producto.
5. HTTPS válido + SecurityHeaders.com (objetivo A) + Fail2Ban (429 + baneo).

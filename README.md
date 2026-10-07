# Solución Web Distribuida en AWS — Mini-Market (Frontend + Backend + Postgres)

> **2 piezas desplegables, una por VPS:**
> - **VPS 1 Front:** `git clone <repo-front> && cd frontend && ./start.sh http://<IP-PRIVADA-BACK>:8000 <dominio>`
> - **VPS 2 Back:** `git clone <repo-back> && cd backend && cp .env.example .env && nano .env && ./start.sh`
> - Detalle en `frontend/README.md` y `backend/README.md`. **Sin IPs por defecto**: la real se integra al ejecutar cada `./start.sh`.

```
solucion-web-distribuida-aws/
├── frontend/   # React + Nginx (proxy /api y /images) → VPS FRONT
│   ├── src/ · Dockerfile · docker-compose.yml · start.sh
│   └── fail2ban/ (jail + filtro nginx + acción DOCKER-USER)
├── backend/    # FastAPI hexagonal + Postgres (SPs) → VPS BACK privado
│   ├── app/ · db/init.sql · Dockerfile · docker-compose.yml · start.sh
└── README.md
```

## Arquitectura de red (2 VPC + Peering)

```
Navegador → https://<dominio>  ──►  VPS FRONT (VPC 10.0.0.0/17, público)
      │                                nginx :80/:443
      │                                  ├─ /            → app React
      │                                  └─ /api /images → proxy por Peering
      ▼                                                         │
   HTTPS (Certbot en el front)                                  ▼
                                        VPS BACK (VPC 10.0.128.0/17, privado)
                                        FastAPI :8000 + Postgres (volúmenes)
```

- El navegador **nunca** toca la IP privada del back (same-origin).
- Peering `pcx-xxxx`: Front RT `10.0.128.0/17→pcx`; Back RT `10.0.0.0/17→pcx`.
- Security Groups:

| VPS | Entrada | Origen |
|---|---|---|
| Front | 22 (SSH) · 80 · 443 | tu IP · `0.0.0.0/0` · `0.0.0.0/0` |
| Back | 22 (SSH) · **8000** | tu IP · **solo el CIDR de la VPC Front** |

- Subred privada del back necesita salida a internet (**NAT Gateway**) para
  `docker pull` y paquetes del sistema; alternativa: `docker save/load`.

## Funcionalidades (resumen)

- Tienda con carrito **drawer en el navbar**, icono con contador, persistente
  (reservas en DB + espejo local; comprar exige cuenta de cliente).
- Ticket en vivo (subtotal, descuentos, IVA 16%, total) y **ticket elegante**
  descargable/impreso al pagar. Pago: efectivo, débito, crédito, transferencia
  (aviso obligatorio de página de prueba; tarjeta solo en memoria).
- Admin: alta/edición de productos con **Departamento** (en DB) + imágenes
  (disco, cuota 50 MB), reabasto por popup (departamento → producto → sumar),
  descuentos por departamento, alertas de stock < 5. Sin carrito para admin
  (403 en API) y sin datos de clientes (privacidad).
- Cliente: catálogo por secciones, urgencias de stock, historial, perfil
  (engrane) y cambio de contraseña.
- Seguridad: JWT (PyJWT, alg fijo) en **cookie HttpOnly** (nada de token en
  JS/localStorage, 15 min, `Secure` en producción), roles, sanitización,
  rate-limit + 429, Fail2Ban en el front, cabeceras, CORS cerrado, `/docs`
  apagable y arranque denegado con JWT_SECRET de ejemplo.

## Seguridad por capas (dónde vive cada cosa)

| Control | Dónde | Archivo |
|---|---|---|
| Security Groups (solo 80/443 público; 8000 privado) | AWS | consola |
| Proxy inverso (back privado, sin CORS) | VPS Front | `frontend/docker-entrypoint.sh` |
| HTTPS + renovación (Certbot) | VPS Front | `frontend/README.md` |
| Fail2Ban (banea IP real en DOCKER-USER) | VPS Front | `frontend/fail2ban/` |
| Rate-limit + sanitización + JWT + roles | Back | `backend/app/` |
| Postgres solo por stored procedures (rol `pos`) | Back | `backend/db/init.sql` |

## Pruebas (mínimas)

1. Peering: desde el VPS Front `curl http://<IP-PRIVADA-BACK>:8000/api/health`.
2. Tienda pública + registro + login (JWT) + carrito persistente + compra + ticket.
3. Admin: reabasto, descuentos por departamento, alertas stock, edición de productos.
4. HTTPS válido (candado, DevTools 443) + SecurityHeaders.com (A).
5. 6 logins fallidos → 429 en API y baneo en `fail2ban-client status nginx-login`.

## Desarrollo local (2 terminales)

```bash
# Terminal 1 (back: API + Postgres en Docker)
cd backend && docker compose up --build
# Terminal 2 (front en dev: Vite proxya /api y /images al backend, igual que nginx)
cd frontend && npm install && npm run dev   # → http://localhost:5173
```

En dev el navegador usa el mismo origen y Vite reenvía al backend
(`/api`, `/images`). Si tu backend está en otro host:
`VITE_DEV_API=http://IP:8000 npm run dev`.

## Entregables de la actividad

URLs git de front/back, diagrama de arquitectura (VPCs, subredes, IPs,
rutas, peering, SGs, flujo JWT, HTTPS, Zero Trust y arquitecturas de
software), evidencias de implementación y pruebas, reporte técnico,
SecurityHeaders.com y evidencias de HTTPS/JWT/Fail2Ban.

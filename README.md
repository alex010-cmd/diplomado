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

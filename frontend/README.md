# FRONTEND — Mini-Market (VPS 1, VPC Frontend)

React + Vite servido con Nginx. **No lleva base de datos.** Además de servir
la app, este nginx hace de **proxy inverso** hacia el backend privado:

```
Navegador → https://<dominio> (VPS Front, público)
                 └─ nginx: / y /api + /images  →  proxy por VPC Peering
                                                  → VPS Back privado :8000
```

Así el navegador nunca toca la IP privada del backend, no hay CORS, y el
certificado HTTPS solo vive aquí.

## Clonar y correr (un comando)

```bash
git clone <URL-DE-ESTE-REPO> frontend
cd frontend
./start.sh http://<IP-PRIVADA-BACK>:8000 <tu-host>.ddns.net
```

- 1er argumento (obligatorio): IP privada del backend.
- 2do argumento (opcional): dominio de Certbot; activa HTTPS cuando exista
  el certificado.
- Sin argumentos reutiliza el `.env` existente. **Sin IPs por defecto**: si
  falta `BACKEND_URL`, el contenedor falla con error.

Abre `http://<IP-pública-de-este-VPS>` (o `https://<dominio>` con TLS).
Verifica el proxy:

```bash
curl -s http://localhost/api/health   # → {"status":"ok"}  (viene del back)
```

## Cambiar la IP del backend

```bash
./start.sh http://<NUEVA-IP-PRIVADA>:8000 <tu-host>.ddns.net
```

No requiere reconstruir a mano: el contenedor regenera el proxy al arrancar.

## HTTPS (Certbot, VPS Front)

Con el contenedor corriendo (HTTP + reto ACME ya configurado):

```bash
mkdir -p /var/www/certbot
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d <tu-host>.ddns.net --email <tu-correo> --agree-tos --no-eff-email
docker compose restart web   # activa 443 + redirección
```

Renovación automática (cron):

```bash
( crontab -l 2>/dev/null; echo "0 3 * * * docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v /var/www/certbot:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker compose -f \$HOME/frontend/docker-compose.yml restart web" ) | crontab -
```

Luego actualiza el back: `FRONTEND_ORIGIN=https://<tu-host>.ddns.net` y
`docker compose restart api`.

## Fail2Ban (VPS Front)

Con el proxy, la IP real del cliente solo se ve aquí. Instalación:

```bash
# Amazon Linux 2023 (EPEL):
sudo dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm
sudo dnf install -y fail2ban
sudo cp fail2ban/jail.local /etc/fail2ban/jail.d/frontend.conf
sudo cp fail2ban/filter.d/nginx-login.conf /etc/fail2ban/filter.d/
sudo cp fail2ban/action.d/docker-iptables.conf /etc/fail2ban/action.d/
sudo systemctl enable --now fail2ban
sudo fail2ban-client status nginx-login
```

Prueba (6 intentos fallidos → IP baneada en la cadena `DOCKER-USER`):

```bash
for i in {1..6}; do curl -s -o /dev/null -X POST https://<tu-dominio>/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"x","password":"mala"}'; done
sudo fail2ban-client status nginx-login
```

## Comandos útiles

```bash
docker compose logs -f web     # logs de nginx
docker compose down            # apagar
./start.sh <IP> [dominio]      # reconfigurar y levantar
```

## Desarrollo local (sin Docker)

```bash
npm install && npm run dev     # http://localhost:5173
```

Vite proxya `/api` y `/images` al backend (por defecto
`http://localhost:8000`; cambia con `VITE_DEV_API=http://IP:8000 npm run dev`),
asi el navegador usa el mismo origen igual que en produccion.

## Notas

- La sesion es una cookie HttpOnly emitida por el backend (15 min,
  `Secure` con HTTPS): el JS de la pagina nunca ve el token.
- Puertos: **80 y 443** (SG: abiertos a `0.0.0.0/0`).
- El backend permanece privado; este VPS entra por peering hacia su :8000.
- Logs de acceso en `/var/log/nginx-host/access.log` (host y contenedor).

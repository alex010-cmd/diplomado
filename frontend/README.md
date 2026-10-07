# FRONTEND — Mini-Market (VPS 1, VPC Frontend)

React + Vite servido con Nginx. **No lleva base de datos**: solo habla con
el backend del otro VPS.

## Clonar y correr (un comando)

```bash
git clone <URL-DE-ESTE-REPO> frontend
cd frontend
./start.sh http://10.0.128.10:8000
```

Abre `http://<IP-publica-de-este-VPS>` en el navegador. Listo.

## Cambiar la IP del backend (credencial de comunicación)

La **única** credencial que une ambos VPS está en el archivo `.env`:

```ini
BACKEND_URL=http://10.0.128.10:8000
```

| Escenario | Valor de BACKEND_URL |
|---|---|
| Peering (recomendado) | `http://10.0.128.10:8000` (IP **privada** del VPS Back + puerto 8000) |
| Dominio con HTTPS | `https://tu-dominio.com` |

OJO: es la URL que ve el **navegador del cliente**, no el contenedor. Si el
back solo es alcanzable por IP privada (peering), el navegador debe estar en
una red con acceso a esa IP (VPN/peering) o usa el dominio público.

Para cambiarla después, **sin reconstruir a mano**:

```bash
./start.sh http://NUEVA-IP:8000
# o edita .env y luego: docker compose up -d
```

El contenedor genera `/env.js` al arrancar con ese valor; verifica en el
navegador: `http://<tu-front>/env.js`.

## Comandos útiles

```bash
docker compose logs -f web   # ver logs
docker compose down          # apagar
docker compose up -d --build # reconstruir
```

## Notas

- Puerto: **80** (Security Group: 80/443 desde `0.0.0.0/0`).
- HTTPS: `sudo certbot --nginx -d tu-dominio.com` en este VPS.
- Cabeceras de seguridad ya van en `nginx.conf`.

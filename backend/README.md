# BACKEND — Mini-Market API (VPS 2, VPC Backend)

FastAPI hexagonal + Postgres (todo vía stored procedures). **Privado**: no se
expone a internet; solo el nginx del front lo alcanza por VPC Peering.

## Clonar y correr (un comando)

```bash
git clone <URL-DE-ESTE-REPO> backend
cd backend
cp .env.example .env
nano .env        # <-- EDITA LAS CREDENCIALES DE ABAJO
./start.sh
```

Verifica: `curl http://localhost:8000/api/health` → `{"status":"ok"}`.

## Credenciales que debes modificar

Todo vive en el archivo **`.env`** (nunca se sube a git):

| Variable | Qué poner | Ejemplo |
|---|---|---|
| `FRONTEND_ORIGIN` | Origen **público** del front (dominio HTTPS o IP pública del front) | `https://<tu-host>.ddns.net` |
| `JWT_SECRET` | Secreto real de 64 hex. Genera: `openssl rand -hex 32`. Sin esto el API **no arranca** | `9f2c...` (64 caracteres) |
| `POSTGRES_PASSWORD` | Password del superusuario Postgres (solo creación inicial) | `Una-Clave-Fuerte-123` |
| `ENABLE_DOCS` | `False` en producción (no expone `/docs`) | `False` |
| `COOKIE_SECURE` | `False` en local (http), `True` en producción (HTTPS) | `True` |
| `DATABASE_URL` | **NO TOCAR** (es interna del compose: `db:5432`). Aquí NO van IPs | — |

Regla de oro de las IPs (todas se integran al ejecutar `./start.sh`, sin
defaults en el código):
- En el **front** (`.env` del front) va la IP/URL **privada del back** (`BACKEND_URL`).
- En el **back** (`.env` del back) va el origen del **front** (`FRONTEND_ORIGIN`).
- Nunca pongas la IP del propio VPS en su propio `.env`.

## Probar el peering desde el VPS Front

```bash
curl http://<IP-PRIVADA-BACK>:8000/api/health
```

## Comandos útiles

```bash
docker compose logs -f api      # ver logs del API
docker compose logs -f db       # ver Postgres
docker compose down             # apagar (los datos quedan en el volumen pgdata)
docker compose down -v          # apagar BORRANDO la DB (cuidado)
```

## Notas

- Puerto **8000**, Security Group: solo `TCP 8000` desde el CIDR de la VPC
  del front (ej. `10.0.0.0/17`). Nada de `0.0.0.0/0`.
- Imágenes en volumen `imgdata` (`/code/uploads`), cuota 50 MB.
- Fail2Ban va en el **VPS FRONT** (`frontend/fail2ban/`), porque con el proxy
  la IP real del cliente solo se ve allí (ver README raíz).
- Admin inicial: `admin / Admin123*` (cámbialo en producción).

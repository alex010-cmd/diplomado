# BACKEND — Mini-Market API (VPS 2, VPC Backend)

FastAPI hexagonal + Postgres (todo vía stored procedures). **Privado**: no se
expone a internet, solo al front por VPC Peering.

## Clonar y correr (un comando)

```bash
git clone <URL-DE-ESTE-REPO> backend
cd backend
cp .env.example .env
nano .env        # <-- EDITA LAS 3 CREDENCIALES DE ABAJO
./start.sh
```

Verifica: `curl http://localhost:8000/api/health` → `{"status":"ok"}`.

## Credenciales que debes modificar (comunicación + secretos)

Todo vive en el archivo **`.env`** (nunca se sube a git). Tabla exacta:

| Variable | Qué poner | Ejemplo |
|---|---|---|
| `FRONTEND_ORIGIN` | Origen **público** del front (lo que ve el navegador). Es la IP que el front usa para mostrarse / tu dominio | `https://tu-dominio.com` o `http://10.0.0.10` |
| `JWT_SECRET` | Secreto real de 64 hex. Genera: `openssl rand -hex 32`. Sin esto el API **no arranca** | `9f2c...` (64 caracteres) |
| `POSTGRES_PASSWORD` | Password del superusuario Postgres (solo creación inicial) | `Una-Clave-Fuerte-123` |
| `DATABASE_URL` | **NO TOCAR** (es interna del compose: `pos:pos123@db:5432`). La IP del front NO va aquí | — |

Regla de oro de las IPs:
- En el **front** (`.env` del front) va la IP/URL del **back** (`BACKEND_URL`).
- En el **back** (`.env` del back) va el origen del **front** (`FRONTEND_ORIGIN`).
- Nunca pongas la IP del propio VPS en su propio `.env`.

## Probar el peering desde el VPS Front

```bash
curl http://10.0.128.10:8000/api/health
```

## Comandos útiles

```bash
docker compose logs -f api      # ver logs (incluye LOGIN FAILED para Fail2Ban)
docker compose logs -f db       # ver Postgres
docker compose down             # apagar (los datos quedan en el volumen pgdata)
docker compose down -v          # apagar BORRANDO la DB (cuidado)
```

## Notas

- Puerto **8000**, Security Group: solo `TCP 8000` desde `10.0.0.0/17` (la VPC del front). Nada de `0.0.0.0/0`.
- Imágenes en volumen `imgdata` (`/code/uploads`), cuota 50 MB.
- Fail2Ban: `fail2ban/jail.local` + filtro (ver README raíz).
- Admin inicial: `admin / Admin123*` (cámbialo en producción).

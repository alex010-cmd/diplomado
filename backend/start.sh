#!/bin/bash
# VPS BACKEND — un solo comando.
# 1) cp .env.example .env
# 2) Edita .env (JWT_SECRET, FRONTEND_ORIGIN, POSTGRES_PASSWORD)
# 3) ./start.sh
set -e
cd "$(dirname "$0")"
[ -f .env ] || { cp .env.example .env; echo ">> .env creado desde el ejemplo: EDITALO y vuelve a correr ./start.sh"; exit 1; }
if grep -q "cambia-este-secreto-en-produccion-min-32-chars" .env; then
  echo ">> ERROR: pon un JWT_SECRET real en .env (genera con: openssl rand -hex 32)"
  exit 1
fi
docker compose up -d --build
echo ">> Esperando Postgres + API..."
sleep 8
curl -sf http://localhost:8000/api/health && echo ">> Backend OK en :8000"

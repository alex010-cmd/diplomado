#!/bin/bash
# VPS BACKEND — un solo comando.
# 1) cp .env.example .env
# 2) Edita .env si quieres (JWT_SECRET se genera solo si falta)
# 3) ./start.sh
set -e
cd "$(dirname "$0")"
[ -f .env ] || { cp .env.example .env; echo ">> .env creado desde el ejemplo."; }

# JWT_SECRET: si falta o sigue siendo el de ejemplo, se genera automaticamente
SECRET=$(grep -E '^JWT_SECRET=' .env | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$SECRET" ] || [ "$SECRET" = "cambia-este-secreto-en-produccion-min-32-chars" ]; then
  NEW=$(openssl rand -hex 32)
  if grep -qE '^JWT_SECRET=' .env; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$NEW|" .env
  else
    echo "JWT_SECRET=$NEW" >> .env
  fi
  echo ">> JWT_SECRET generado automaticamente (openssl rand -hex 32)."
fi

docker compose up -d --build
echo ">> Esperando Postgres + API..."
for i in $(seq 1 20); do
  sleep 2
  if curl -sf http://localhost:8000/api/health >/dev/null 2>&1; then
    echo ">> Backend OK en :8000 (http://localhost:8000/api/health)"
    exit 0
  fi
done
echo ">> AVISO: el API no respondio en ~40s. Revisa: docker compose logs -f api"
exit 1

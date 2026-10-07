#!/bin/bash
# VPS FRONTEND — un solo comando.
# Uso: ./start.sh [URL_DEL_BACKEND]
#   ./start.sh http://10.0.128.10:8000   (por VPC Peering)
#   ./start.sh https://tu-dominio.com    (por dominio)
# Sin argumento usa el .env actual.
set -e
cd "$(dirname "$0")"
if [ -n "$1" ]; then
  echo "BACKEND_URL=$1" > .env
  echo ">> BACKEND_URL guardado: $1"
fi
[ -f .env ] || cp .env.example .env
docker compose up -d --build
echo ">> Front corriendo en el puerto 80, hablando con: $(grep BACKEND_URL .env | cut -d= -f2-)"
echo ">> Para cambiar la IP del backend: ./start.sh http://NUEVA-IP:8000"

#!/bin/bash
# VPS FRONTEND — un solo comando.
# Uso: ./start.sh http://<IP-PRIVADA-BACK>:8000 [dominio-certbot]
#   ./start.sh http://10.x.x.x:8000                (solo HTTP)
#   ./start.sh http://10.x.x.x:8000 mi-host.ddns.net (activa HTTPS si ya hay cert)
set -e
cd "$(dirname "$0")"

if [ -n "$1" ]; then
  case "$1" in
    http://*|https://*) ;;
    *) echo ">> ERROR: BACKEND_URL invalido: $1 (usa http://IP:PUERTO)"; exit 1 ;;
  esac
  {
    echo "BACKEND_URL=$1"
    [ -n "$2" ] && echo "TLS_DOMAIN=$2"
  } > .env
  echo ">> .env actualizado (BACKEND_URL=$1${2:+, TLS_DOMAIN=$2})"
elif [ ! -f .env ]; then
  echo ">> ERROR: no hay .env. Uso: ./start.sh http://<IP-PRIVADA-BACK>:8000 [dominio]"
  exit 1
fi

if ! grep -qE '^BACKEND_URL=.+' .env; then
  echo ">> ERROR: define BACKEND_URL en .env (IP privada del backend)."
  exit 1
fi

# Directorios de trabajo para Certbot y Fail2Ban (docker los crea si faltan)
mkdir -p /var/www/certbot /var/log/nginx-host /etc/letsencrypt 2>/dev/null \
  || sudo -n mkdir -p /var/www/certbot /var/log/nginx-host /etc/letsencrypt 2>/dev/null \
  || echo ">> Aviso: no se pudieron pre-crear dirs de Certbot/Fail2Ban (docker los creara)."

docker compose up -d --build
echo ">> Front corriendo (80/443), backend en: $(grep '^BACKEND_URL=' .env | cut -d= -f2-)"
echo ">> Cambiar IP del backend: ./start.sh http://NUEVA-IP:8000 [dominio]"

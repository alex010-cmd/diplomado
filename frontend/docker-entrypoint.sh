#!/bin/sh
# FRONT: sirve la app React y proxya /api y /images al backend privado
# (por VPC Peering). El navegador solo habla con ESTE nginx (same-origin).
#
# BACKEND_URL: OBLIGATORIO, IP/URL privada del backend. Se integra al
#              ejecutar ./start.sh en el VPS (no hay IP por defecto).
# TLS_DOMAIN : opcional; si existen certificados de Certbot para el
#              dominio, activa HTTPS + redireccion 80->443.
set -e

if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: falta BACKEND_URL. Usa: ./start.sh http://<IP-PRIVADA-BACK>:8000 [dominio]" >&2
  exit 1
fi
case "$BACKEND_URL" in
  http://*|https://*) ;;
  *) echo "ERROR: BACKEND_URL invalido: $BACKEND_URL" >&2; exit 1 ;;
esac

SNIP=/etc/nginx/snippets
mkdir -p "$SNIP" /var/www/certbot /var/log/nginx-host

# Cliente same-origin: el navegador nunca toca la IP privada del backend.
printf '// Generado al arrancar (no editar).\nwindow.__API_URL = "";\n' \
  > /usr/share/nginx/html/env.js

# Cabeceras de seguridad (SecurityHeaders.com)
cat > "$SNIP/headers.conf" <<'EOF'
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:;" always;
EOF

# Proxy inverso al backend privado. X-Forwarded-For se PISA con $remote_addr
# (no se agrega) para que la API/Fail2Ban vean la IP real del cliente.
cat > "$SNIP/app-locations.conf" <<EOF
location = /env.js {
  add_header Cache-Control "no-store";
}
location /api/ {
  proxy_pass $BACKEND_URL;
  proxy_http_version 1.1;
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$remote_addr;
  proxy_set_header X-Forwarded-Proto \$scheme;
  client_max_body_size 3m;
  proxy_read_timeout 60s;
}
location /images/ {
  proxy_pass $BACKEND_URL;
  proxy_set_header X-Forwarded-For \$remote_addr;
  proxy_set_header X-Forwarded-Proto \$scheme;
  expires 7d;
}
location /.well-known/acme-challenge/ {
  root /var/www/certbot;
}
location / {
  try_files \$uri /index.html;
}
EOF

CERT="/etc/letsencrypt/live/${TLS_DOMAIN:-none}/fullchain.pem"
KEY="/etc/letsencrypt/live/${TLS_DOMAIN:-none}/privkey.pem"

if [ -n "$TLS_DOMAIN" ] && [ -f "$CERT" ]; then
  echo "TLS activo para $TLS_DOMAIN"
  # HTTPS + redireccion desde HTTP (dejando libre el reto ACME)
  cat > /etc/nginx/conf.d/default.conf <<EOF
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
server {
  listen 80;
  server_name $TLS_DOMAIN;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://\$host\$request_uri; }
}
server {
  listen 443 ssl;
  http2 on;
  server_name $TLS_DOMAIN;
  ssl_certificate     $CERT;
  ssl_certificate_key $KEY;
  ssl_protocols TLSv1.2 TLSv1.3;
  access_log /var/log/nginx-host/access.log;
  root /usr/share/nginx/html;
  index index.html;
  include $SNIP/headers.conf;
  include $SNIP/app-locations.conf;
}
EOF
else
  if [ -n "$TLS_DOMAIN" ]; then
    echo "AVISO: sin certificado de $TLS_DOMAIN en /etc/letsencrypt; sirviendo HTTP (ejecuta Certbot y reinicia)."
  fi
  cat > /etc/nginx/conf.d/default.conf <<EOF
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
server {
  listen 80 default_server;
  server_name _;
  access_log /var/log/nginx-host/access.log;
  root /usr/share/nginx/html;
  index index.html;
  include $SNIP/headers.conf;
  include $SNIP/app-locations.conf;
}
EOF
fi

nginx -t
echo "Frontend sirviendo. Backend (proxy) = $BACKEND_URL"
exec nginx -g "daemon off;"

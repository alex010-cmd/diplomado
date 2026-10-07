#!/bin/sh
# Genera /env.js con la IP/URL del backend SIN reconstruir la imagen.
# BACKEND_URL llega por environment (.env del compose o -e).
set -e
URL="${BACKEND_URL:-http://localhost:8000}"
printf '// Generado al arrancar (BACKEND_URL). No editar.\nwindow.__API_URL = "%s";\n' "$URL" \
  > /usr/share/nginx/html/env.js
echo "Frontend sirviendo. Backend = $URL"
exec nginx -g "daemon off;"

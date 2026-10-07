# Etapa build (Node)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# Etapa produccion (Nginx: sirve la app + proxy al backend privado)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80 443
# El entrypoint valida BACKEND_URL, genera env.js (same-origin), el proxy
# /api y /images, y activa TLS si existen certificados de Certbot.
CMD ["/docker-entrypoint.sh"]

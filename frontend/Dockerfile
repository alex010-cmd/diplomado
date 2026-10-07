# Etapa build (Node)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# Etapa produccion (Nginx con cabeceras de seguridad)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
# Escribe /env.js con BACKEND_URL y arranca Nginx (sin rebuild al cambiar IP)
CMD ["/docker-entrypoint.sh"]

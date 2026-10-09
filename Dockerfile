FROM node:22-alpine AS compilacion
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
ENV API_UPSTREAM=http://host.docker.internal:8080
ENV API_FORWARDED_PROTO=http
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=compilacion /app/dist /usr/share/nginx/html
EXPOSE 80

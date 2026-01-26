# ---------- Build Stage ----------
FROM node:20-alpine AS build

WORKDIR /app

# pnpm aktivieren
RUN corepack enable

# Nur das kopieren, was pnpm braucht (Cache!)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Dependencies installieren (nur web + shared)
RUN pnpm install --frozen-lockfile --filter @relay/web...

# Source Code kopieren
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY packages packages

# Build ausführen
RUN pnpm --filter @relay/web build




# ---------- Runtime Stage ----------
FROM nginx:alpine

# nginx default config entfernen
RUN rm /etc/nginx/conf.d/default.conf

# Eigene nginx config
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Gebautes Frontend reinkopieren
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

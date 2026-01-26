# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable

# Root workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy ONLY package.json files for workspaces (damit pnpm Graph bauen kann)
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
# Wenn du mehr packages hast, die api braucht, hier ebenfalls deren package.json:
# COPY packages/<x>/package.json packages/<x>/package.json

# Install deps for api (+ its workspace deps)
RUN pnpm install --frozen-lockfile --filter @relay/api... --prod=false

RUN pnpm config set ignore-scripts false

# Prisma schema muss für generate vorhanden sein
COPY apps/api/prisma apps/api/prisma

# Generate Prisma client (wichtig!)
RUN pnpm --filter @relay/api exec prisma generate


# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable

# node_modules aus deps übernehmen
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=deps /app/package.json /app/package.json
COPY --from=deps /app/apps/api/package.json /app/apps/api/package.json
COPY --from=deps /app/packages/shared/package.json /app/packages/shared/package.json

# Jetzt erst Source kopieren
COPY apps/api apps/api
COPY packages/shared packages/shared
# ggf. weitere packages:
# COPY packages/<x> packages/<x>

# Build TS -> dist
#RUN pnpm --filter @relay/api build
RUN pnpm -C apps/api run build




# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Nur das Nötigste: dist + prisma client runtime files + node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/node_modules node_modules

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]

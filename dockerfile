# pnpm is installed with npm at the exact version package.json pins
# ("packageManager"). Node 25+ no longer ships corepack, so `corepack enable`
# fails on `node:lts-alpine` with "not found" (exit 127).
#
# 1. Build stage
FROM node:lts-alpine AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")" \
	&& pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# 2. Runtime stage
FROM node:lts-alpine AS runner
WORKDIR /app

# Copy only the built output + necessary files
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY migrations ./migrations
COPY scripts ./scripts

# Install only production deps, then remove package-manager caches to keep the image lean.
RUN npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")" \
	&& pnpm install --prod --frozen-lockfile \
	&& pnpm store prune \
	&& rm -rf /root/.cache /root/.local/share/pnpm \
	&& mkdir -p public/uploads/avatars

ENV TZ=UTC
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000
CMD ["sh", "-c", "node ./scripts/migrate.mjs && node ./dist/server/entry.mjs"]

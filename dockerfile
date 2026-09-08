# 1. Build stage
FROM node:lts-alpine AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

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
RUN corepack enable \
	&& pnpm install --prod --frozen-lockfile \
	&& pnpm store prune \
	&& rm -rf /root/.cache /root/.local/share/pnpm \
	&& mkdir -p public/uploads/avatars

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000
CMD ["sh", "-c", "node ./scripts/migrate.mjs && node ./dist/server/entry.mjs"]

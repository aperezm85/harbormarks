# 1. Build stage
FROM node:lts-alpine AS build
WORKDIR /app

ARG HARBOR_CHECK_ORIGIN=false
ENV HARBOR_CHECK_ORIGIN=$HARBOR_CHECK_ORIGIN

COPY package.json pnpm-lock.yaml ./
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

# Install only production deps (Astro preview needs them)
RUN corepack enable && pnpm install --prod --frozen-lockfile

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000
CMD ["node", "./dist/server/entry.mjs"]

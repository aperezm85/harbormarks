# 1. Build stage
FROM node:lts AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# 2. Runtime stage
FROM node:lts AS runner
WORKDIR /app

# Copy only the built output + necessary files
COPY --from=build /app/dist ./dist
COPY package.json ./

# Install only production deps (Astro preview needs them)
RUN corepack enable && pnpm install --prod --frozen-lockfile

EXPOSE 3000
CMD ["pnpm", "run", "preview"]

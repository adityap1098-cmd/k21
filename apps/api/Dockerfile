# Build context: repo root (set in docker-compose.yml build.context: .)
# Stage 1: dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace manifests from repo root
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install only production + api dependencies
RUN pnpm install --frozen-lockfile --filter @k21/api...

# Stage 2: build
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

# Build shared package first (api depends on it)
RUN pnpm --filter @k21/shared build
RUN pnpm --filter @k21/api build

# Stage 3: production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy compiled output and production node_modules only
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3001
CMD ["node", "dist/index.js"]

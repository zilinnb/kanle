# ===== Stage 1: Builder =====
FROM node:22-alpine AS builder

WORKDIR /app/backend

# 启用 corepack + pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package*.json ./
RUN pnpm install --no-frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# ===== Stage 2: Runtime =====
FROM node:22-alpine AS runtime

WORKDIR /app/backend

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package*.json ./
RUN pnpm install --prod --no-frozen-lockfile && pnpm store prune

COPY --from=builder /app/backend/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p plugins public/uploads

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]

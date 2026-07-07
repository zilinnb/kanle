# ===== Stage 1: Builder =====
FROM node:22-alpine AS builder

WORKDIR /app/backend

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ===== Stage 2: Runtime =====
FROM node:22-alpine AS runtime

WORKDIR /app/backend

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/backend/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p plugins public/uploads

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]

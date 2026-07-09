# ===== Stage 1: Dependencies =====
FROM node:22-alpine AS deps

WORKDIR /app/frontend

COPY package*.json ./
RUN npm ci

# ===== Stage 2: Builder =====
FROM node:22-alpine AS builder

WORKDIR /app/frontend

COPY --from=deps /app/frontend/node_modules ./node_modules
COPY . .

# 构建时参数（NEXT_PUBLIC_* 在 next build 时内联，运行时修改无效）
# NEXT_PUBLIC_API_URL=/api：相对路径，通过 Next.js rewrites 代理到后端，任何域名/IP 通用
# BACKEND_URL：rewrites 代理目标，构建时求值（Docker 默认用容器名，PM2 用 localhost）
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_TWIKOO_ENV_ID=
ARG NEXT_PUBLIC_REVALIDATE_SECRET=kanle-revalidate
ARG BACKEND_URL=http://kanle-backend:4000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TWIKOO_ENV_ID=$NEXT_PUBLIC_TWIKOO_ENV_ID
ENV NEXT_PUBLIC_REVALIDATE_SECRET=$NEXT_PUBLIC_REVALIDATE_SECRET
ENV BACKEND_URL=$BACKEND_URL

RUN npm run build

# ===== Stage 3: Runtime =====
FROM node:22-alpine AS runtime

WORKDIR /app

# standalone 产物不包含 .next/static 和 public/，需单独拷贝
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["node", "server.js"]

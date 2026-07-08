#!/bin/bash
# ============================================================
#  kanle · Docker CLI 一键部署脚本
#  用法: 修改下方配置后运行 bash docker-cli.sh
# ============================================================

# ====================== 按需修改 ======================
DB_PASSWORD="change-me-to-strong"     # MySQL 密码（务必修改）
JWT_SECRET="change-me-to-random-32+"  # JWT 密钥（务必改为随机长字符串）
ADMIN_PASSWORD="123456"               # 管理员密码
FRONTEND_PORT=3000                    # 前端访问端口
BACKEND_PORT=4000                     # 后端 API 端口
MYSQL_PORT=3306                       # MySQL 端口（一般不用改）
DB_NAME=moment_blog                   # 数据库名
DB_USER=kanle                         # 数据库用户名
# ======================================================

set -e

NETWORK="kanle-net"
MYSQL_CONTAINER="kanle-mysql"
BACKEND_CONTAINER="kanle-backend"
FRONTEND_CONTAINER="kanle-frontend"

echo "========================================"
echo "  kanle Docker CLI 部署"
echo "========================================"
echo "  前端端口: $FRONTEND_PORT"
echo "  后端端口: $BACKEND_PORT"
echo "  MySQL 端口: $MYSQL_PORT"
echo "  数据库名: $DB_NAME"
echo "  数据库用户: $DB_USER"
echo "========================================"
echo ""

# 创建网络
if ! docker network ls --format '{{.Name}}' | grep -q "^${NETWORK}$"; then
  docker network create "$NETWORK"
  echo "[1/4] 网络 $NETWORK 已创建"
else
  echo "[1/4] 网络 $NETWORK 已存在，跳过"
fi

# MySQL
if docker ps -a --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
  echo "[2/4] MySQL 容器已存在，跳过（如需重建请先 docker rm -f $MYSQL_CONTAINER）"
else
  docker run -d \
    --name "$MYSQL_CONTAINER" \
    --network "$NETWORK" \
    -e MYSQL_ROOT_PASSWORD="$DB_PASSWORD" \
    -e MYSQL_DATABASE="$DB_NAME" \
    -e MYSQL_USER="$DB_USER" \
    -e MYSQL_PASSWORD="$DB_PASSWORD" \
    -p "${MYSQL_PORT}:3306" \
    -v kanle-mysql-data:/var/lib/mysql \
    --restart unless-stopped \
    mysql:8.0
  echo "[2/4] MySQL 已启动"
fi

# Backend
if docker ps -a --format '{{.Names}}' | grep -q "^${BACKEND_CONTAINER}$"; then
  echo "[3/4] 后端容器已存在，跳过（如需重建请先 docker rm -f $BACKEND_CONTAINER）"
else
  docker run -d \
    --name "$BACKEND_CONTAINER" \
    --network "$NETWORK" \
    -e DB_HOST="$MYSQL_CONTAINER" \
    -e DB_PORT=3306 \
    -e DB_USER="$DB_USER" \
    -e DB_PASSWORD="$DB_PASSWORD" \
    -e DB_NAME="$DB_NAME" \
    -e JWT_SECRET="$JWT_SECRET" \
    -e ADMIN_EMAIL="admin@kanle.net" \
    -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    -e ADMIN_USERNAME="admin" \
    -e CLIENT_URL="http://localhost:${FRONTEND_PORT}" \
    -e REVALIDATE_SECRET="kanle-revalidate" \
    -p "${BACKEND_PORT}:4000" \
    -v kanle-uploads:/app/backend/public/uploads \
    -v kanle-plugins:/app/backend/plugins \
    --restart unless-stopped \
    zilinnb/kanle-backend:latest
  echo "[3/4] 后端已启动"
fi

# Frontend
if docker ps -a --format '{{.Names}}' | grep -q "^${FRONTEND_CONTAINER}$"; then
  echo "[4/4] 前端容器已存在，跳过（如需重建请先 docker rm -f $FRONTEND_CONTAINER）"
else
  docker run -d \
    --name "$FRONTEND_CONTAINER" \
    --network "$NETWORK" \
    -e REVALIDATE_SECRET="kanle-revalidate" \
    -e PORT=3000 \
    -e HOSTNAME=0.0.0.0 \
    -p "${FRONTEND_PORT}:3000" \
    --restart unless-stopped \
    zilinnb/kanle-frontend:latest
  echo "[4/4] 前端已启动"
fi

echo ""
echo "========================================"
echo "  部署完成!"
echo "========================================"
echo "  前端:      http://localhost:${FRONTEND_PORT}"
echo "  后台:      http://localhost:${FRONTEND_PORT}/admin/login"
echo "  管理员:    admin"
echo "  密码:      $ADMIN_PASSWORD"
echo "========================================"
echo ""
echo "常用命令:"
echo "  查看日志:  docker logs -f $FRONTEND_CONTAINER"
echo "  停止:      docker stop $FRONTEND_CONTAINER $BACKEND_CONTAINER $MYSQL_CONTAINER"
echo "  启动:      docker start $MYSQL_CONTAINER $BACKEND_CONTAINER $FRONTEND_CONTAINER"
echo "  删除重建:  docker rm -f $FRONTEND_CONTAINER $BACKEND_CONTAINER $MYSQL_CONTAINER"

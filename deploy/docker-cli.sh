#!/bin/bash
# ============================================================
#  kanle · Docker CLI 一键部署脚本
#  用法: 修改下方配置后运行 bash docker-cli.sh
# ============================================================

# ====================== 按需修改 ======================
# 是否使用宿主机已安装的 MySQL（如宝塔面板自带的 MySQL）
#   false = 用 Docker 里的 MySQL 容器（默认，开箱即用）
#   true  = 跳过 MySQL 容器，连接宿主机 MySQL（适配宝塔面板等场景）
USE_LOCAL_MYSQL=false

# 数据库地址（仅 USE_LOCAL_MYSQL=true 时生效）：
#   - host.docker.internal  → 推荐，脚本会自动加 host-gateway，容器通过它访问宿主机
#   - 172.17.0.1            → Docker 默认网桥的宿主机 IP（host.docker.internal 不生效时备用）
#   - 192.168.x.x / 公网 IP → 跨机器部署时使用
DB_HOST="host.docker.internal"

DB_PORT=3306                            # MySQL 端口
DB_PASSWORD="change-me-to-strong"       # MySQL 密码（务必修改）
JWT_SECRET="change-me-to-random-32+"    # JWT 密钥（务必改为随机长字符串）
ADMIN_PASSWORD="123456"                 # 管理员密码
FRONTEND_PORT=3000                      # 前端访问端口
BACKEND_PORT=4000                       # 后端 API 端口
MYSQL_PORT=3306                         # MySQL 容器映射到宿主机的端口（仅 USE_LOCAL_MYSQL=false 时生效）
MYSQL_VERSION="8.0"                     # MySQL 版本：5.7 或 8.0 均可（仅 USE_LOCAL_MYSQL=false 时生效）
DB_NAME=moment_blog                     # 数据库名
DB_USER=kanle                           # 数据库用户名
# ======================================================

set -e

# 兼容 Windows CRLF 编辑（去除变量末尾的 \r）
USE_LOCAL_MYSQL="${USE_LOCAL_MYSQL%$'\r'}"
DB_HOST="${DB_HOST%$'\r'}"
DB_PORT="${DB_PORT%$'\r'}"
DB_PASSWORD="${DB_PASSWORD%$'\r'}"
JWT_SECRET="${JWT_SECRET%$'\r'}"
MYSQL_VERSION="${MYSQL_VERSION%$'\r'}"
MYSQL_PORT="${MYSQL_PORT%$'\r'}"
DB_NAME="${DB_NAME%$'\r'}"
DB_USER="${DB_USER%$'\r'}"

NETWORK="kanle-net"
MYSQL_CONTAINER="kanle-mysql"
BACKEND_CONTAINER="kanle-backend"
FRONTEND_CONTAINER="kanle-frontend"
MYSQL_IMAGE="mysql:${MYSQL_VERSION:-8.0}"

echo "========================================"
echo "  kanle Docker CLI 部署"
echo "========================================"
echo "  前端端口:   $FRONTEND_PORT"
echo "  后端端口:   $BACKEND_PORT"
if [ "$USE_LOCAL_MYSQL" = "true" ]; then
  echo "  MySQL:      使用宿主机 ($DB_HOST:$DB_PORT)"
  echo "  数据库名:   $DB_NAME"
  echo "  数据库用户: $DB_USER"
else
  echo "  MySQL 端口: $MYSQL_PORT"
  echo "  MySQL 版本: $MYSQL_VERSION"
  echo "  数据库名:   $DB_NAME"
  echo "  数据库用户: $DB_USER"
fi
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
if [ "$USE_LOCAL_MYSQL" = "true" ]; then
  echo "[2/4] USE_LOCAL_MYSQL=true，跳过 MySQL 容器，连接宿主机 $DB_HOST:$DB_PORT"
  # 如果存在旧的 kanle-mysql 容器，它会占着 3306 端口，需要提示用户删除
  if docker ps -a --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
    echo ""
    echo "  ⚠️  检测到旧的 $MYSQL_CONTAINER 容器仍在占用 ${MYSQL_PORT} 端口，"
    echo "     这会导致宿主机 MySQL 连接冲突。请先删除它："
    echo ""
    echo "       docker rm -f $MYSQL_CONTAINER"
    echo ""
    echo "     删除后重新运行 bash docker-cli.sh"
    exit 1
  fi
  # 宝塔 MySQL 用户注意事项
  echo ""
  echo "  ⚠️  使用宿主机 MySQL 注意事项（宝塔面板用户必看）："
  echo "     1. 宝塔面板 → 数据库 → 找到 $DB_USER 用户 → 权限改为「所有人」"
  echo "        （容器访问宿主机时来源 IP 是 172.17.0.1，host=localhost 会拒绝）"
  echo "     2. 宝塔面板 → 安全 → 放行 3306 端口（或限制来源为 172.17.0.0/16）"
  echo "     3. 数据库 $DB_NAME 需提前在宝塔面板创建好（字符集 utf8mb4）"
  echo ""
  DB_HOST_FOR_BACKEND="$DB_HOST"
  DB_PORT_FOR_BACKEND="$DB_PORT"
else
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
      "$MYSQL_IMAGE"
    echo "[2/4] MySQL 已启动 ($MYSQL_IMAGE)"
  fi
  DB_HOST_FOR_BACKEND="$MYSQL_CONTAINER"
  DB_PORT_FOR_BACKEND=3306
fi

# Backend
if docker ps -a --format '{{.Names}}' | grep -q "^${BACKEND_CONTAINER}$"; then
  echo "[3/4] 后端容器已存在，跳过（如需重建请先 docker rm -f $BACKEND_CONTAINER）"
else
  # 使用宿主机 MySQL + host.docker.internal 时，需要 --add-host 让容器能解析该域名
  ADD_HOST_ARG=()
  if [ "$USE_LOCAL_MYSQL" = "true" ] && [ "$DB_HOST" = "host.docker.internal" ]; then
    ADD_HOST_ARG=(--add-host=host.docker.internal:host-gateway)
  fi

  docker run -d \
    --name "$BACKEND_CONTAINER" \
    --network "$NETWORK" \
    "${ADD_HOST_ARG[@]}" \
    -e DB_HOST="$DB_HOST_FOR_BACKEND" \
    -e DB_PORT="$DB_PORT_FOR_BACKEND" \
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
echo "  前端:   http://localhost:${FRONTEND_PORT}"
echo "  后台:   http://localhost:${FRONTEND_PORT}/admin/login"
echo "  账号:   admin"
echo "  密码:   $ADMIN_PASSWORD"
echo "========================================"
echo ""
echo "常用命令:"
echo "  查看日志:  docker logs -f $FRONTEND_CONTAINER"
if [ "$USE_LOCAL_MYSQL" = "true" ]; then
  echo "  停止:      docker stop $FRONTEND_CONTAINER $BACKEND_CONTAINER"
  echo "  启动:      docker start $BACKEND_CONTAINER $FRONTEND_CONTAINER"
  echo "  删除重建:  docker rm -f $FRONTEND_CONTAINER $BACKEND_CONTAINER"
else
  echo "  停止:      docker stop $FRONTEND_CONTAINER $BACKEND_CONTAINER $MYSQL_CONTAINER"
  echo "  启动:      docker start $MYSQL_CONTAINER $BACKEND_CONTAINER $FRONTEND_CONTAINER"
  echo "  删除重建:  docker rm -f $FRONTEND_CONTAINER $BACKEND_CONTAINER $MYSQL_CONTAINER"
fi

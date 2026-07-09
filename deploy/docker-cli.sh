#!/bin/bash
# ============================================================
#  kanle · Docker 交互式部署脚本
#  用法: bash docker-cli.sh
#        bash docker-cli.sh --no-prompt   # 用默认值跳过交互（CI/重复部署）
# ============================================================

# ====================== 默认值（交互时回车采用）======================
DEFAULT_DB_HOST="host.docker.internal"   # 宿主机 MySQL 地址（容器通过它访问宿主机）
DEFAULT_DB_PORT="3306"
DEFAULT_DB_NAME="moment_blog"
DEFAULT_DB_USER="kanle"
DEFAULT_MYSQL_VERSION="8.0"              # Docker MySQL 容器版本：5.7 / 8.0
DEFAULT_MYSQL_PORT="3306"
DEFAULT_FRONTEND_PORT="3000"
DEFAULT_BACKEND_PORT="4000"
DEFAULT_ADMIN_USERNAME="admin"
DEFAULT_ADMIN_EMAIL="admin@kanle.net"
DEFAULT_ADMIN_PASSWORD="123456"
# ====================================================================

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# 工具函数
prompt() {
  local var=$1
  local question=$2
  local default=$3
  local is_secret=${4:-false}
  local input
  if [ "$is_secret" = "true" ]; then
    read -s -p "$(echo -e "  ${question}")" input
    echo ""
  else
    read -p "$(echo -e "  ${question}")" input
  fi
  eval "$var=\"\${input:-\$default}\""
}

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$1"
  else
    head -c 100 /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c "$1"
  fi
}

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  kanle · Docker 交互式部署${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "  ${YELLOW}提示：直接回车 = 采用 [方括号] 中的默认值${NC}"
echo ""

# ============================================================
# [1/5] MySQL 配置
# ============================================================
echo -e "${CYAN}${BOLD}[1/5] MySQL 配置${NC}"

USE_LOCAL_MYSQL="false"
if [ "$1" != "--no-prompt" ]; then
  read -p "$(echo -e "  是否使用宿主机已安装的 MySQL（如宝塔面板自带的）？[y/N]: ")" _choice
  _choice=$(echo "${_choice:-N}" | tr '[:upper:]' '[:lower:]')
  if [ "$_choice" = "y" ] || [ "$_choice" = "yes" ]; then
    USE_LOCAL_MYSQL="true"
  fi
fi

if [ "$USE_LOCAL_MYSQL" = "true" ]; then
  echo -e "  ${YELLOW}→ 已选：使用宿主机 MySQL（如宝塔面板自带的）${NC}"
  echo -e "  ${YELLOW}  数据库地址说明：${NC}"
  echo -e "  ${YELLOW}    • host.docker.internal → 推荐，容器通过它访问宿主机（脚本自动加 host-gateway）${NC}"
  echo -e "  ${YELLOW}    • 172.17.0.1            → Docker 默认网桥的宿主机 IP${NC}"
  echo -e "  ${YELLOW}    • 服务器公网/内网 IP    → 跨机器部署时使用${NC}"
  prompt DB_HOST "数据库主机地址 [host.docker.internal]: " "$DEFAULT_DB_HOST"
  prompt DB_PORT "数据库端口 [3306]: " "$DEFAULT_DB_PORT"
  prompt DB_NAME "数据库名 [moment_blog]: " "$DEFAULT_DB_NAME"
  prompt DB_USER "数据库用户名 [kanle]: " "$DEFAULT_DB_USER"

  # 数据库密码：必填，不回显
  while true; do
    prompt DB_PASSWORD "数据库密码（必填，不回显）: " "" true
    if [ -n "$DB_PASSWORD" ]; then
      break
    fi
    echo -e "  ${RED}密码不能为空，请重新输入${NC}"
  done
else
  echo -e "  ${YELLOW}→ 已选：使用 Docker MySQL 容器（开箱即用）${NC}"
  # MySQL 版本
  while true; do
    prompt MYSQL_VERSION "MySQL 版本 [5.7/8.0]（回车默认 8.0）: " "$DEFAULT_MYSQL_VERSION"
    if [ "$MYSQL_VERSION" = "5.7" ] || [ "$MYSQL_VERSION" = "8.0" ]; then
      break
    fi
    echo -e "  ${RED}版本必须是 5.7 或 8.0${NC}"
  done
  prompt MYSQL_PORT "MySQL 容器映射端口 [3306]: " "$DEFAULT_MYSQL_PORT"
  prompt DB_NAME "数据库名 [moment_blog]: " "$DEFAULT_DB_NAME"
  prompt DB_USER "数据库用户名 [kanle]: " "$DEFAULT_DB_USER"

  # 数据库密码：可回车自动生成
  prompt DB_PASSWORD "数据库密码（回车自动生成）: " "" true
  if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD=$(gen_secret 24)
    echo -e "  ${YELLOW}→ 已自动生成密码: ${BOLD}${DB_PASSWORD}${NC}"
    echo -e "  ${YELLOW}  请妥善保存（部署后也可在 docker inspect 中查看）${NC}"
  fi
fi

# ============================================================
# [2/5] 端口配置
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[2/5] 端口配置${NC}"
prompt FRONTEND_PORT "前端访问端口 [3000]: " "$DEFAULT_FRONTEND_PORT"
prompt BACKEND_PORT "后端 API 端口 [4000]: " "$DEFAULT_BACKEND_PORT"

# ============================================================
# [3/5] 管理员配置
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[3/5] 管理员配置（首次部署创建账号，之后改密码请进后台）${NC}"
prompt ADMIN_USERNAME "管理员用户名 [admin]: " "$DEFAULT_ADMIN_USERNAME"
prompt ADMIN_EMAIL "管理员邮箱 [admin@kanle.net]: " "$DEFAULT_ADMIN_EMAIL"
prompt ADMIN_PASSWORD "管理员密码 [123456]: " "$DEFAULT_ADMIN_PASSWORD" true
# 管理员密码允许默认值，不强制改

# ============================================================
# [4/5] JWT 密钥
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[4/5] JWT 密钥${NC}"
echo -e "  ${YELLOW}JWT 密钥用于签发登录 Token，建议自动生成（回车即可）${NC}"
prompt JWT_SECRET "JWT 密钥（回车自动生成）: " "" true
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(gen_secret 48)
  echo -e "  ${YELLOW}→ 已自动生成 JWT 密钥（48 位）${NC}"
fi

# ============================================================
# [5/5] 确认配置
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[5/5] 确认配置${NC}"
echo -e "  ${BOLD}----------------------------------------${NC}"
if [ "$USE_LOCAL_MYSQL" = "true" ]; then
  echo -e "  MySQL 模式:     ${GREEN}宿主机${NC}（${DB_HOST}:${DB_PORT}）"
  echo -e "  ${YELLOW}  ⚠️  请确保宝塔面板已：${NC}"
  echo -e "  ${YELLOW}     1. 创建数据库 ${DB_NAME}（用户 ${DB_USER}，权限「所有人」）${NC}"
  echo -e "  ${YELLOW}     2. 放行 ${DB_PORT} 端口${NC}"
else
  echo -e "  MySQL 模式:     ${GREEN}Docker 容器${NC}（mysql:${MYSQL_VERSION}）"
  echo -e "  MySQL 端口:     ${MYSQL_PORT}"
fi
echo -e "  数据库名:       ${DB_NAME}"
echo -e "  数据库用户:     ${DB_USER}"
echo -e "  前端端口:       ${FRONTEND_PORT}"
echo -e "  后端端口:       ${BACKEND_PORT}"
echo -e "  管理员用户名:   ${ADMIN_USERNAME}"
echo -e "  管理员邮箱:     ${ADMIN_EMAIL}"
echo -e "  管理员密码:     ${ADMIN_PASSWORD}"
echo -e "  ${BOLD}----------------------------------------${NC}"
echo ""

if [ "$1" != "--no-prompt" ]; then
  read -p "$(echo -e "  ${BOLD}确认部署？[Y/n]${NC}: ")" CONFIRM
  CONFIRM=$(echo "${CONFIRM:-Y}" | tr '[:upper:]' '[:lower:]')
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "yes" ]; then
    echo -e "  ${YELLOW}已取消部署${NC}"
    exit 0
  fi
fi

# ============================================================
# 开始部署
# ============================================================
set -e

NETWORK="kanle-net"
MYSQL_CONTAINER="kanle-mysql"
BACKEND_CONTAINER="kanle-backend"
FRONTEND_CONTAINER="kanle-frontend"
MYSQL_IMAGE="mysql:${MYSQL_VERSION:-8.0}"

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  开始部署...${NC}"
echo -e "${BOLD}========================================${NC}"

# 创建网络
if ! docker network ls --format '{{.Name}}' | grep -q "^${NETWORK}$"; then
  docker network create "$NETWORK"
  echo -e "${GREEN}[1/4]${NC} 网络 $NETWORK 已创建"
else
  echo -e "${GREEN}[1/4]${NC} 网络 $NETWORK 已存在，跳过"
fi

# MySQL
if [ "$USE_LOCAL_MYSQL" = "true" ]; then
  echo -e "${GREEN}[2/4]${NC} 使用宿主机 MySQL，跳过容器创建"
  # 如果存在旧的 kanle-mysql 容器，它会占着端口，提示删除
  if docker ps -a --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
    echo -e "  ${RED}⚠️  检测到旧的 ${MYSQL_CONTAINER} 容器仍占用端口，可能导致冲突${NC}"
    echo -e "  ${YELLOW}   建议删除: docker rm -f ${MYSQL_CONTAINER}${NC}"
  fi
  DB_HOST_FOR_BACKEND="$DB_HOST"
  DB_PORT_FOR_BACKEND="$DB_PORT"
else
  if docker ps -a --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
    echo -e "${GREEN}[2/4]${NC} MySQL 容器已存在，跳过（重建请先 docker rm -f $MYSQL_CONTAINER）"
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
      "$MYSQL_IMAGE" >/dev/null
    echo -e "${GREEN}[2/4]${NC} MySQL 已启动 ($MYSQL_IMAGE)"
  fi
  DB_HOST_FOR_BACKEND="$MYSQL_CONTAINER"
  DB_PORT_FOR_BACKEND=3306
fi

# Backend
if docker ps -a --format '{{.Names}}' | grep -q "^${BACKEND_CONTAINER}$"; then
  echo -e "${GREEN}[3/4]${NC} 后端容器已存在，跳过（重建请先 docker rm -f $BACKEND_CONTAINER）"
else
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
    -e ADMIN_EMAIL="$ADMIN_EMAIL" \
    -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    -e ADMIN_USERNAME="$ADMIN_USERNAME" \
    -e CLIENT_URL="http://localhost:${FRONTEND_PORT}" \
    -e REVALIDATE_SECRET="kanle-revalidate" \
    -p "${BACKEND_PORT}:4000" \
    -v kanle-uploads:/app/backend/public/uploads \
    -v kanle-plugins:/app/backend/plugins \
    --restart unless-stopped \
    zilinnb/kanle-backend:latest >/dev/null
  echo -e "${GREEN}[3/4]${NC} 后端已启动"
fi

# Frontend
if docker ps -a --format '{{.Names}}' | grep -q "^${FRONTEND_CONTAINER}$"; then
  echo -e "${GREEN}[4/4]${NC} 前端容器已存在，跳过（重建请先 docker rm -f $FRONTEND_CONTAINER）"
else
  docker run -d \
    --name "$FRONTEND_CONTAINER" \
    --network "$NETWORK" \
    -e REVALIDATE_SECRET="kanle-revalidate" \
    -e PORT=3000 \
    -e HOSTNAME=0.0.0.0 \
    -p "${FRONTEND_PORT}:3000" \
    --restart unless-stopped \
    zilinnb/kanle-frontend:latest >/dev/null
  echo -e "${GREEN}[4/4]${NC} 前端已启动"
fi

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  ✅ 部署完成!${NC}"
echo -e "${BOLD}========================================${NC}"
echo -e "  前端:   ${BOLD}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "  后台:   ${BOLD}http://localhost:${FRONTEND_PORT}/admin/login${NC}"
echo -e "  账号:   ${ADMIN_USERNAME}（或邮箱 ${ADMIN_EMAIL}）"
echo -e "  密码:   ${ADMIN_PASSWORD}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "${BOLD}常用命令:${NC}"
echo "  查看日志:  docker logs -f $FRONTEND_CONTAINER"
echo "  后端日志:  docker logs -f $BACKEND_CONTAINER"
if [ "$USE_LOCAL_MYSQL" = "true" ]; then
  echo "  停止:      docker stop $FRONTEND_CONTAINER $BACKEND_CONTAINER"
  echo "  启动:      docker start $BACKEND_CONTAINER $FRONTEND_CONTAINER"
  echo "  删除重建:  docker rm -f $FRONTEND_CONTAINER $BACKEND_CONTAINER"
else
  echo "  停止:      docker stop $FRONTEND_CONTAINER $BACKEND_CONTAINER $MYSQL_CONTAINER"
  echo "  启动:      docker start $MYSQL_CONTAINER $BACKEND_CONTAINER $FRONTEND_CONTAINER"
  echo "  删除重建:  docker rm -f $FRONTEND_CONTAINER $BACKEND_CONTAINER $MYSQL_CONTAINER"
fi
echo ""

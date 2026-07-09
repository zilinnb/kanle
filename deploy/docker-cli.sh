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
DEFAULT_FRONTEND_URL="http://localhost:3000"
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

# 从前端访问地址推导后端 API 地址
#   http://localhost:3000     → http://localhost:4000/api
#   http://1.2.3.4:3000       → http://1.2.3.4:4000/api
#   https://yourdomain.com    → https://yourdomain.com/api  (Nginx 反代 /api/ → 4000)
#   http://yourdomain.com:8080→ http://yourdomain.com:4000/api
derive_api_url() {
  local url="$1"
  local backend_port="$2"
  # 提取 scheme://host[:port]
  local host_part
  host_part=$(echo "$url" | sed -E 's|^(https?://[^/]+).*|\1|')
  local scheme
  scheme=$(echo "$host_part" | sed -E 's|^(https?)://.*|\1|')
  local rest
  rest=$(echo "$host_part" | sed -E 's|^https?://||')
  # 去掉端口
  local host_no_port
  host_no_port=$(echo "$rest" | sed -E 's|:[0-9]+$||')
  # 判断原 URL 是否带显式端口
  local has_port
  has_port=$(echo "$rest" | grep -E ':[0-9]+$' || true)
  if [ -n "$has_port" ]; then
    # 带端口：把端口换成后端端口
    echo "${scheme}://${host_no_port}:${backend_port}/api"
  else
    # 不带端口（80/443，说明有 Nginx 反代）：API 用同域 /api
    echo "${scheme}://${host_no_port}/api"
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
# [1/6] MySQL 配置
# ============================================================
echo -e "${CYAN}${BOLD}[1/6] MySQL 配置${NC}"

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

  while true; do
    prompt DB_PASSWORD "数据库密码（必填，不回显）: " "" true
    if [ -n "$DB_PASSWORD" ]; then
      break
    fi
    echo -e "  ${RED}密码不能为空，请重新输入${NC}"
  done
else
  echo -e "  ${YELLOW}→ 已选：使用 Docker MySQL 容器（开箱即用）${NC}"
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

  prompt DB_PASSWORD "数据库密码（回车自动生成）: " "" true
  if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD=$(gen_secret 24)
    echo -e "  ${YELLOW}→ 已自动生成密码: ${BOLD}${DB_PASSWORD}${NC}"
    echo -e "  ${YELLOW}  请妥善保存（部署后也可在 docker inspect 中查看）${NC}"
  fi
fi

# ============================================================
# [2/6] 端口配置
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[2/6] 端口配置${NC}"
prompt FRONTEND_PORT "前端访问端口 [3000]: " "$DEFAULT_FRONTEND_PORT"
prompt BACKEND_PORT "后端 API 端口 [4000]: " "$DEFAULT_BACKEND_PORT"

# ============================================================
# [3/6] 访问地址配置（决定前端如何调用后端 API，重要！）
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[3/6] 访问地址配置${NC}"
echo -e "  ${YELLOW}前端访问地址是浏览器实际打开的 URL，决定前端调用后端 API 的地址${NC}"
echo -e "  ${YELLOW}• 本地体验：http://localhost:3000（用预构建镜像，无需构建）${NC}"
echo -e "  ${YELLOW}• 公网 IP：http://45.192.100.137:3000（需从源码构建前端）${NC}"
echo -e "  ${YELLOW}• 域名+反代：https://yourdomain.com（需 Nginx 把 /api/ 代理到 4000）${NC}"
prompt FRONTEND_URL "前端访问地址 [http://localhost:3000]: " "$DEFAULT_FRONTEND_URL"

# 推导后端 API 地址
DERIVED_API_URL=$(derive_api_url "$FRONTEND_URL" "$BACKEND_PORT")
echo -e "  ${YELLOW}→ 根据前端地址推导的后端 API 地址：${DERIVED_API_URL}${NC}"
echo -e "  ${YELLOW}  回车采用推导值，或自行输入（如用 Nginx 反代可填 https://域名/api）${NC}"
prompt API_URL "后端 API 地址 [${DERIVED_API_URL}]: " "$DERIVED_API_URL"

# 判断是否需要从源码构建前端
if echo "$API_URL" | grep -q "localhost\|127.0.0.1"; then
  BUILD_FRONTEND_FROM_SOURCE="false"
  FRONTEND_IMAGE="zilinnb/kanle-frontend:latest"
  echo -e "  ${GREEN}→ localhost 访问，使用预构建镜像（无需构建）${NC}"
else
  BUILD_FRONTEND_FROM_SOURCE="true"
  echo -e "  ${YELLOW}→ 非 localhost 访问，需要从源码构建前端镜像（约 3-5 分钟）${NC}"
  # 如果 API 地址的 host 和前端访问地址的 host 相同（同域不同端口），需要放行后端端口
  API_HOST=$(echo "$API_URL" | sed -E 's|^https?://||' | sed -E 's|[:/].*||')
  FRONTEND_HOST=$(echo "$FRONTEND_URL" | sed -E 's|^https?://||' | sed -E 's|[:/].*||')
  if [ "$API_HOST" = "$FRONTEND_HOST" ]; then
    API_PORT=$(echo "$API_URL" | sed -E 's|^https?://[^/]+:||' | sed -E 's|/.*||')
    if [ -n "$API_PORT" ] && [ "$API_PORT" != "80" ] && [ "$API_PORT" != "443" ]; then
      echo -e "  ${YELLOW}  ⚠️  需要在宝塔/云服务商安全组放行后端端口 ${API_PORT}${NC}"
    fi
  fi
fi

# ============================================================
# [4/6] 管理员配置
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[4/6] 管理员配置（首次部署创建账号，之后改密码请进后台）${NC}"
prompt ADMIN_USERNAME "管理员用户名 [admin]: " "$DEFAULT_ADMIN_USERNAME"
prompt ADMIN_EMAIL "管理员邮箱 [admin@kanle.net]: " "$DEFAULT_ADMIN_EMAIL"
prompt ADMIN_PASSWORD "管理员密码 [123456]: " "$DEFAULT_ADMIN_PASSWORD" true

# ============================================================
# [5/6] JWT 密钥
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[5/6] JWT 密钥${NC}"
echo -e "  ${YELLOW}JWT 密钥用于签发登录 Token，建议自动生成（回车即可）${NC}"
prompt JWT_SECRET "JWT 密钥（回车自动生成）: " "" true
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(gen_secret 48)
  echo -e "  ${YELLOW}→ 已自动生成 JWT 密钥（48 位）${NC}"
fi

# ============================================================
# [6/6] 确认配置
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[6/6] 确认配置${NC}"
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
echo -e "  前端访问地址:   ${FRONTEND_URL}"
echo -e "  后端 API 地址:  ${API_URL}"
if [ "$BUILD_FRONTEND_FROM_SOURCE" = "true" ]; then
  echo -e "  前端镜像:       ${YELLOW}从源码构建${NC}（NEXT_PUBLIC_API_URL=${API_URL}）"
else
  echo -e "  前端镜像:       ${GREEN}预构建${NC}（zilinnb/kanle-frontend:latest）"
fi
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
  echo -e "${GREEN}[1/5]${NC} 网络 $NETWORK 已创建"
else
  echo -e "${GREEN}[1/5]${NC} 网络 $NETWORK 已存在，跳过"
fi

# MySQL
if [ "$USE_LOCAL_MYSQL" = "true" ]; then
  echo -e "${GREEN}[2/5]${NC} 使用宿主机 MySQL，跳过容器创建"
  if docker ps -a --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
    echo -e "  ${RED}⚠️  检测到旧的 ${MYSQL_CONTAINER} 容器仍占用端口，可能导致冲突${NC}"
    echo -e "  ${YELLOW}   建议删除: docker rm -f ${MYSQL_CONTAINER}${NC}"
  fi
  DB_HOST_FOR_BACKEND="$DB_HOST"
  DB_PORT_FOR_BACKEND="$DB_PORT"
else
  if docker ps -a --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
    echo -e "${GREEN}[2/5]${NC} MySQL 容器已存在，跳过（重建请先 docker rm -f $MYSQL_CONTAINER）"
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
    echo -e "${GREEN}[2/5]${NC} MySQL 已启动 ($MYSQL_IMAGE)"
  fi
  DB_HOST_FOR_BACKEND="$MYSQL_CONTAINER"
  DB_PORT_FOR_BACKEND=3306
fi

# Backend
if docker ps -a --format '{{.Names}}' | grep -q "^${BACKEND_CONTAINER}$"; then
  echo -e "${GREEN}[3/5]${NC} 后端容器已存在，跳过（重建请先 docker rm -f $BACKEND_CONTAINER）"
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
    -e CLIENT_URL="$FRONTEND_URL" \
    -e REVALIDATE_SECRET="kanle-revalidate" \
    -p "${BACKEND_PORT}:4000" \
    -v kanle-uploads:/app/backend/public/uploads \
    -v kanle-plugins:/app/backend/plugins \
    --restart unless-stopped \
    zilinnb/kanle-backend:latest >/dev/null
  echo -e "${GREEN}[3/5]${NC} 后端已启动"
fi

# Frontend
if [ "$BUILD_FRONTEND_FROM_SOURCE" = "true" ]; then
  echo -e "${GREEN}[4/5]${NC} 从源码构建前端镜像（NEXT_PUBLIC_API_URL=$API_URL）..."

  # 定位 frontend 源码目录
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  FRONTEND_SRC=""
  if [ -f "$SCRIPT_DIR/../frontend/Dockerfile" ]; then
    FRONTEND_SRC="$SCRIPT_DIR/../frontend"
  elif [ -f "./frontend/Dockerfile" ]; then
    FRONTEND_SRC="./frontend"
  elif [ -f "./Dockerfile" ] && [ -f "./package.json" ] && grep -q '"next"' ./package.json 2>/dev/null; then
    FRONTEND_SRC="."
  fi

  if [ -z "$FRONTEND_SRC" ]; then
    echo -e "  ${YELLOW}  未找到 frontend 源码，正在 clone 代码...${NC}"
    git clone --depth 1 https://gitee.com/ziln_cn/kanle.git /tmp/kanle-build
    FRONTEND_SRC="/tmp/kanle-build/frontend"
  fi

  echo -e "  ${YELLOW}  源码目录: $FRONTEND_SRC${NC}"
  echo -e "  ${YELLOW}  构建 中...（约 3-5 分钟，请耐心等待）${NC}"
  docker build \
    --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
    --build-arg NEXT_PUBLIC_REVALIDATE_SECRET="kanle-revalidate" \
    -t kanle-frontend:custom \
    "$FRONTEND_SRC" 2>&1 | tail -5
  FRONTEND_IMAGE="kanle-frontend:custom"
  echo -e "  ${GREEN}  前端镜像构建完成${NC}"
else
  FRONTEND_IMAGE="zilinnb/kanle-frontend:latest"
fi

if docker ps -a --format '{{.Names}}' | grep -q "^${FRONTEND_CONTAINER}$"; then
  echo -e "${GREEN}[5/5]${NC} 前端容器已存在，跳过（重建请先 docker rm -f $FRONTEND_CONTAINER）"
else
  docker run -d \
    --name "$FRONTEND_CONTAINER" \
    --network "$NETWORK" \
    -e REVALIDATE_SECRET="kanle-revalidate" \
    -e PORT=3000 \
    -e HOSTNAME=0.0.0.0 \
    -p "${FRONTEND_PORT}:3000" \
    --restart unless-stopped \
    "$FRONTEND_IMAGE" >/dev/null
  echo -e "${GREEN}[5/5]${NC} 前端已启动 ($FRONTEND_IMAGE)"
fi

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  ✅ 部署完成!${NC}"
echo -e "${BOLD}========================================${NC}"
echo -e "  前端:   ${BOLD}${FRONTEND_URL}${NC}"
echo -e "  后台:   ${BOLD}${FRONTEND_URL}/admin/login${NC}"
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

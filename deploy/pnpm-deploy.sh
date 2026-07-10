#!/bin/bash
# ============================================================
#  kanle · pnpm 本地部署脚本（适配宝塔面板 / 1Panel）
#
#  用法:
#    bash pnpm-deploy.sh              # 交互式部署
#    bash pnpm-deploy.sh --update     # 更新代码 + 重新构建（不重新配置）
#    bash pnpm-deploy.sh --no-prompt  # 全部采用默认值（CI/重复部署）
#
#  ✨ 使用 pnpm 安装依赖，比 npm 快 3 倍，磁盘占用小
#  ✨ PM2 执行 pnpm start，pm2 logs 可查看日志
#  ✨ 自动检测宝塔面板 / 1Panel，生成对应 Nginx 配置
#  ✨ 前后端共用前端端口，只需放行一个端口
# ============================================================

# ====================== 默认值 ======================
DEFAULT_INSTALL_DIR="/www/wwwroot/kanle"
DEFAULT_DB_HOST="127.0.0.1"
DEFAULT_DB_PORT="3306"
DEFAULT_DB_NAME="moment_blog"
DEFAULT_DB_USER="kanle"
DEFAULT_FRONTEND_PORT="3000"
DEFAULT_ADMIN_USERNAME="admin"
DEFAULT_ADMIN_EMAIL="admin@kanle.net"
DEFAULT_ADMIN_PASSWORD="123456"
DEFAULT_GIT_REPO="https://gitee.com/ziln_cn/kanle.git"
# ====================================================

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

# 检测面板类型
detect_panel() {
  if [ -d "/www/server/panel" ]; then
    echo "bt"
  elif [ -d "/opt/1panel" ] || command -v 1pctl >/dev/null 2>&1; then
    echo "1panel"
  else
    echo "none"
  fi
}

# 检测 Node.js
check_node() {
  if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
      return 0
    fi
  fi
  return 1
}

# 安装 pnpm
ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    echo -e "  ${GREEN}pnpm 已安装: $(pnpm -v)${NC}"
    return 0
  fi

  if command -v corepack >/dev/null 2>&1; then
    echo -e "  ${YELLOW}通过 corepack 启用 pnpm...${NC}"
    corepack enable 2>/dev/null
    corepack prepare pnpm@latest --activate 2>/dev/null
    if command -v pnpm >/dev/null 2>&1; then
      echo -e "  ${GREEN}pnpm 已安装: $(pnpm -v)${NC}"
      return 0
    fi
  fi

  echo -e "  ${YELLOW}通过 npm 安装 pnpm...${NC}"
  npm install -g pnpm 2>/dev/null
  if command -v pnpm >/dev/null 2>&1; then
    echo -e "  ${GREEN}pnpm 已安装: $(pnpm -v)${NC}"
    return 0
  fi

  echo -e "  ${RED}pnpm 安装失败，请手动安装: npm install -g pnpm${NC}"
  return 1
}

# ============================================================
# 更新模式
# ============================================================
if [ "$1" = "--update" ]; then
  INSTALL_DIR="${DEFAULT_INSTALL_DIR}"

  echo ""
  echo -e "${BOLD}========================================${NC}"
  echo -e "${BOLD}  kanle · 代码更新 + 重新构建${NC}"
  echo -e "${BOLD}========================================${NC}"
  echo ""

  if [ ! -d "$INSTALL_DIR/.git" ]; then
    echo -e "  ${RED}未找到项目目录 $INSTALL_DIR${NC}"
    echo -e "  ${YELLOW}请先运行 bash pnpm-deploy.sh 进行首次部署${NC}"
    exit 1
  fi

  ensure_pnpm || exit 1

  echo -e "${CYAN}[1/4]${NC} 拉取最新代码..."
  cd "$INSTALL_DIR"
  git pull origin main || { echo -e "  ${RED}git pull 失败${NC}"; exit 1; }

  echo -e "${CYAN}[2/4]${NC} 更新后端依赖 + 构建..."
  cd "$INSTALL_DIR/backend"
  pnpm i
  pnpm build

  echo -e "${CYAN}[3/4]${NC} 更新前端依赖 + 构建..."
  cd "$INSTALL_DIR/frontend"
  pnpm i

  echo -e "  ${YELLOW}停止前端进程（避免 .next/static 缺失导致崩溃）...${NC}"
  pm2 stop kanle-frontend 2>/dev/null
  pnpm build
  pm2 start kanle-frontend 2>/dev/null || pm2 restart kanle-frontend 2>/dev/null

  echo -e "${CYAN}[4/4]${NC} 重启后端..."
  pm2 restart kanle-backend 2>/dev/null
  pm2 save 2>/dev/null

  echo ""
  echo -e "${GREEN}${BOLD}  ✅ 更新完成!${NC}"
  echo -e "  pm2 status 查看运行状态"
  echo ""
  exit 0
fi

# ============================================================
# 首次部署（交互式）
# ============================================================
PANEL_TYPE=$(detect_panel)

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  kanle · pnpm 本地部署${NC}"
echo -e "${BOLD}  适配宝塔面板 / 1Panel${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "  ${YELLOW}提示：直接回车 = 采用 [方括号] 中的默认值${NC}"
echo -e "  ${GREEN}✨ 使用 pnpm 安装依赖，比 npm 快 3 倍${NC}"
echo -e "  ${GREEN}✨ 前后端共用前端端口，只需放行一个端口${NC}"
echo ""

# 显示面板检测结果
case "$PANEL_TYPE" in
  bt)
    echo -e "  ${GREEN}检测到: 宝塔面板${NC}"
    ;;
  1panel)
    echo -e "  ${GREEN}检测到: 1Panel${NC}"
    ;;
  *)
    echo -e "  ${YELLOW}未检测到面板（宝塔/1Panel），将使用通用路径${NC}"
    ;;
esac
echo ""

# ============================================================
# [1/6] 环境检查
# ============================================================
echo -e "${CYAN}${BOLD}[1/6] 环境检查${NC}"

if ! check_node; then
  echo -e "  ${RED}未找到 Node.js 18+，请先安装：${NC}"
  echo -e "  ${YELLOW}  宝塔面板: 软件商店 → PM2管理器 → 设置 Node.js 22.x${NC}"
  echo -e "  ${YELLOW}  1Panel:   应用商店 → Node.js${NC}"
  echo -e "  ${YELLOW}  手动安装:  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt install -y nodejs${NC}"
  exit 1
fi
echo -e "  ${GREEN}Node.js: $(node -v)${NC}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo -e "  ${YELLOW}PM2 未安装，正在安装...${NC}"
  npm install -g pm2 2>/dev/null
fi
echo -e "  ${GREEN}PM2: $(pm2 -v 2>/dev/null || echo '已安装')${NC}"

if ! command -v mysql >/dev/null 2>&1; then
  echo -e "  ${YELLOW}警告: 未找到 mysql 客户端（不影响部署，但需确保 MySQL 服务可用）${NC}"
fi

ensure_pnpm || exit 1

# ============================================================
# [2/6] 安装路径
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[2/6] 安装路径${NC}"
prompt INSTALL_DIR "项目安装目录 [${DEFAULT_INSTALL_DIR}]: " "$DEFAULT_INSTALL_DIR"

# ============================================================
# [3/6] 数据库配置
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[3/6] 数据库配置${NC}"
echo -e "  ${YELLOW}请在面板中提前创建数据库（字符集 utf8mb4）${NC}"
prompt DB_HOST "数据库地址 [${DEFAULT_DB_HOST}]: " "$DEFAULT_DB_HOST"
prompt DB_PORT "数据库端口 [${DEFAULT_DB_PORT}]: " "$DEFAULT_DB_PORT"
prompt DB_NAME "数据库名 [${DEFAULT_DB_NAME}]: " "$DEFAULT_DB_NAME"
prompt DB_USER "数据库用户名 [${DEFAULT_DB_USER}]: " "$DEFAULT_DB_USER"

while true; do
  prompt DB_PASSWORD "数据库密码（必填，不回显）: " "" true
  if [ -n "$DB_PASSWORD" ]; then
    break
  fi
  echo -e "  ${RED}密码不能为空，请重新输入${NC}"
done

# ============================================================
# [4/6] 管理员配置
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[4/6] 管理员配置（首次部署创建账号）${NC}"
prompt ADMIN_USERNAME "管理员用户名 [${DEFAULT_ADMIN_USERNAME}]: " "$DEFAULT_ADMIN_USERNAME"
prompt ADMIN_EMAIL "管理员邮箱 [${DEFAULT_ADMIN_EMAIL}]: " "$DEFAULT_ADMIN_EMAIL"
prompt ADMIN_PASSWORD "管理员密码 [${DEFAULT_ADMIN_PASSWORD}]: " "$DEFAULT_ADMIN_PASSWORD" true

# ============================================================
# [5/6] JWT 密钥 + 端口
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[5/6] JWT 密钥 + 端口${NC}"
prompt JWT_SECRET "JWT 密钥（回车自动生成）: " "" true
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(gen_secret 48)
  echo -e "  ${YELLOW}→ 已自动生成 JWT 密钥（48 位）${NC}"
fi

prompt FRONTEND_PORT "前端端口 [${DEFAULT_FRONTEND_PORT}]: " "$DEFAULT_FRONTEND_PORT"
echo -e "  ${GREEN}→ 后端不对外暴露端口（通过 rewrites 代理，只需放行 ${FRONTEND_PORT}）${NC}"

# ============================================================
# [6/6] 确认配置
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}[6/6] 确认配置${NC}"
echo -e "  ${BOLD}----------------------------------------${NC}"
echo -e "  安装路径:       ${INSTALL_DIR}"
echo -e "  数据库:         ${DB_HOST}:${DB_PORT}/${DB_NAME}（用户 ${DB_USER}）"
echo -e "  前端端口:       ${FRONTEND_PORT}"
echo -e "  后端端口:       ${GREEN}不对外暴露${NC}（localhost:4000）"
echo -e "  管理员:         ${ADMIN_USERNAME}（${ADMIN_EMAIL}）"
echo -e "  管理员密码:     ${ADMIN_PASSWORD}"
echo -e "  面板类型:       ${PANEL_TYPE:-通用}"
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

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  开始部署...${NC}"
echo -e "${BOLD}========================================${NC}"

# [1] 克隆代码
echo -e "${CYAN}[1/7]${NC} 获取代码..."
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "  ${YELLOW}目录已存在，拉取最新代码...${NC}"
  cd "$INSTALL_DIR"
  git pull origin main 2>/dev/null || true
else
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$DEFAULT_GIT_REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
echo -e "  ${GREEN}代码已就绪${NC}"

# [2] 后端依赖 + 配置 + 构建
echo -e "${CYAN}[2/7]${NC} 后端: 安装依赖..."
cd "$INSTALL_DIR/backend"
pnpm i

echo -e "${CYAN}[3/7]${NC} 后端: 配置环境变量..."
cat > "$INSTALL_DIR/backend/.env" << EOF
NODE_ENV=production
PORT=4000
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_USERNAME=${ADMIN_USERNAME}
CLIENT_URL=http://localhost:${FRONTEND_PORT}
REVALIDATE_SECRET=kanle-revalidate
EOF
echo -e "  ${GREEN}.env 已生成${NC}"

echo -e "${CYAN}[4/7]${NC} 后端: 构建 + 初始化数据库..."
pnpm build
pnpm db:seed

echo -e "${CYAN}[5/7]${NC} 后端: 启动 PM2..."
mkdir -p "$INSTALL_DIR/backend/logs"
pm2 delete kanle-backend 2>/dev/null || true
pm2 start "$INSTALL_DIR/backend/ecosystem.config.js" --name kanle-backend
echo -e "  ${GREEN}后端已启动${NC}"

# [3] 前端依赖 + 配置 + 构建
echo -e "${CYAN}[6/7]${NC} 前端: 安装依赖 + 配置 + 构建..."
cd "$INSTALL_DIR/frontend"
pnpm i

cat > "$INSTALL_DIR/frontend/.env.local" << EOF
NEXT_PUBLIC_API_URL=/api
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_REVALIDATE_SECRET=kanle-revalidate
REVALIDATE_SECRET=kanle-revalidate
PORT=${FRONTEND_PORT}
HOSTNAME=0.0.0.0
EOF

# 修改 ecosystem.config.js 中的端口（如果有自定义）
if [ "$FRONTEND_PORT" != "3003" ]; then
  sed -i "s/-p 3003/-p ${FRONTEND_PORT}/" "$INSTALL_DIR/frontend/ecosystem.config.js" 2>/dev/null || true
fi

mkdir -p "$INSTALL_DIR/frontend/logs"
pm2 delete kanle-frontend 2>/dev/null || true
pnpm build
pm2 start "$INSTALL_DIR/frontend/ecosystem.config.js" --name kanle-frontend
echo -e "  ${GREEN}前端已启动${NC}"

# [4] PM2 保存
pm2 save 2>/dev/null || true

# [5] Nginx 配置
echo -e "${CYAN}[7/7]${NC} 生成 Nginx 配置..."

NGINX_CONF="$INSTALL_DIR/deploy/nginx-pnpm.conf"
cat > "$NGINX_CONF" << 'NGINX_EOF'
# kanle Nginx 反向代理配置
# 只需反代前端端口，/api/ 和 /uploads/ 由 Next.js rewrites 自动代理到后端

server {
    listen 80;
    # server_name yourdomain.com;  # ← 改成你的域名或 IP

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_EOF

sed -i "s/FRONTEND_PORT/${FRONTEND_PORT}/" "$NGINX_CONF"

# 根据面板类型输出安装指引
case "$PANEL_TYPE" in
  bt)
    echo -e "  ${GREEN}宝塔面板 Nginx 配置方法：${NC}"
    echo -e "  ${YELLOW}  1. 宝塔 → 网站 → 添加站点（域名 + 纯静态）${NC}"
    echo -e "  ${YELLOW}  2. 站点设置 → 配置文件，替换为以下内容：${NC}"
    echo -e "  ${YELLOW}  配置文件路径: $NGINX_CONF${NC}"
    echo -e "  ${YELLOW}  3. 或手动复制: sudo cp $NGINX_CONF /www/server/panel/vhost/nginx/kanle.conf${NC}"
    echo -e "  ${YELLOW}  4. sudo nginx -t && sudo nginx -s reload${NC}"
    ;;
  1panel)
    echo -e "  ${GREEN}1Panel Nginx 配置方法：${NC}"
    echo -e "  ${YELLOW}  1. 1Panel → 网站 → 创建网站（反向代理）${NC}"
    echo -e "  ${YELLOW}  2. 代理地址: http://127.0.0.1:${FRONTEND_PORT}${NC}"
    echo -e "  ${YELLOW}  3. 或手动: sudo cp $NGINX_CONF /opt/1panel/apps/openresty/openresty/conf/conf.d/kanle.conf${NC}"
    echo -e "  ${YELLOW}  4. sudo nginx -t && sudo nginx -s reload${NC}"
    ;;
  *)
    echo -e "  ${GREEN}Nginx 配置方法：${NC}"
    echo -e "  ${YELLOW}  sudo cp $NGINX_CONF /etc/nginx/conf.d/kanle.conf${NC}"
    echo -e "  ${YELLOW}  sudo nginx -t && sudo nginx -s reload${NC}"
    ;;
esac

# 完成
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  ✅ 部署完成!${NC}"
echo -e "${BOLD}========================================${NC}"
echo -e "  前端:   ${BOLD}http://你的服务器IP:${FRONTEND_PORT}${NC}"
echo -e "  后台:   ${BOLD}http://你的服务器IP:${FRONTEND_PORT}/admin/login${NC}"
echo -e "  账号:   ${ADMIN_USERNAME}（或邮箱 ${ADMIN_EMAIL}）"
echo -e "  密码:   ${ADMIN_PASSWORD}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "${BOLD}常用命令:${NC}"
echo "  查看状态:  pm2 status"
echo "  查看日志:  pm2 logs kanle-frontend    (或 pm2 logs kanle-backend)"
echo "  停止:      pm2 stop kanle-frontend kanle-backend"
echo "  启动:      pm2 start kanle-frontend kanle-backend"
echo "  重启:      pm2 restart kanle-frontend kanle-backend"
echo "  更新代码:  bash $(realpath "$0") --update"
echo ""
echo -e "${BOLD}手动操作（进入对应目录后）:${NC}"
echo "  安装依赖:  pnpm i"
echo "  构建:      pnpm build"
echo "  启动:      pnpm start    (生产模式)"
echo "  开发:      pnpm dev      (开发模式)"
echo ""
echo -e "${BOLD}PM2 开机自启:${NC}"
echo "  pm2 startup && pm2 save"
echo ""

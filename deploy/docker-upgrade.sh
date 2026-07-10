#!/bin/bash
# ============================================================
#  kanle · Docker 升级脚本（保留所有数据）
#
#  用法:
#    bash docker-upgrade.sh              # 交互式升级
#    bash docker-upgrade.sh --no-backup  # 跳过数据库备份
#    bash docker-upgrade.sh --auto       # 全自动（不确认）
#
#  ✨ 自动提取现有容器配置，重建容器，数据零丢失
#  ✨ 升级前自动备份: 数据库 + 上传文件(图片/视频/音频) + 插件
#  ✨ 支持 docker run 和 docker compose 两种部署方式
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

BACKEND_CONTAINER="kanle-backend"
FRONTEND_CONTAINER="kanle-frontend"
MYSQL_CONTAINER="kanle-mysql"
BACKUP_DIR="./backup"

AUTO_MODE=false
SKIP_BACKUP=false

for arg in "$@"; do
  case $arg in
    --auto)      AUTO_MODE=true ;;
    --no-backup) SKIP_BACKUP=true ;;
  esac
done

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  kanle · Docker 升级（保留数据）${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

# ============================================================
# [1] 检测现有容器
# ============================================================
echo -e "${CYAN}[1/6]${NC} 检测现有容器..."

has_backend=false
has_frontend=false
has_mysql=false
use_compose=false

if docker ps -a --format '{{.Names}}' | grep -q "^${BACKEND_CONTAINER}$"; then
  has_backend=true
  echo -e "  ${GREEN}✓ 后端容器 ${BACKEND_CONTAINER} 已找到${NC}"
else
  echo -e "  ${RED}✗ 未找到后端容器 ${BACKEND_CONTAINER}${NC}"
fi

if docker ps -a --format '{{.Names}}' | grep -q "^${FRONTEND_CONTAINER}$"; then
  has_frontend=true
  echo -e "  ${GREEN}✓ 前端容器 ${FRONTEND_CONTAINER} 已找到${NC}"
else
  echo -e "  ${RED}✗ 未找到前端容器 ${FRONTEND_CONTAINER}${NC}"
fi

if docker ps -a --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
  has_mysql=true
  echo -e "  ${GREEN}✓ MySQL 容器 ${MYSQL_CONTAINER} 已找到${NC}"
fi

# 检测是否使用 docker compose
if [ -f "docker-compose.yml" ] && docker compose ps 2>/dev/null | grep -q "kanle"; then
  use_compose=true
  echo -e "  ${GREEN}✓ 检测到 docker compose 部署${NC}"
fi

if [ "$has_backend" = "false" ] && [ "$has_frontend" = "false" ]; then
  echo -e "\n  ${RED}未找到任何 kanle 容器，请先运行 bash deploy/docker-cli.sh 部署${NC}"
  exit 1
fi

# ============================================================
# [2] 提取现有配置
# ============================================================
echo -e "${CYAN}[2/6]${NC} 提取现有配置..."

# 提取后端环境变量
if [ "$has_backend" = "true" ]; then
  BACKEND_ENV=$(docker inspect "$BACKEND_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null)
  BACKEND_IMAGE=$(docker inspect "$BACKEND_CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)
  BACKEND_NETWORK=$(docker inspect "$BACKEND_CONTAINER" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
  # 提取 volume 挂载
  BACKEND_VOLUMES=$(docker inspect "$BACKEND_CONTAINER" --format '{{range .Mounts}}{{.Type}}:{{.Name}}{{.Source}}:{{.Destination}}{{"\n"}}{{end}}' 2>/dev/null)
  echo -e "  ${GREEN}✓ 后端镜像: ${BACKEND_IMAGE}${NC}"
  echo -e "  ${GREEN}✓ 后端网络: ${BACKEND_NETWORK}${NC}"
fi

# 提取前端环境变量
if [ "$has_frontend" = "true" ]; then
  FRONTEND_ENV=$(docker inspect "$FRONTEND_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null)
  FRONTEND_IMAGE=$(docker inspect "$FRONTEND_CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)
  FRONTEND_NETWORK=$(docker inspect "$FRONTEND_CONTAINER" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
  FRONTEND_PORTS=$(docker inspect "$FRONTEND_CONTAINER" --format '{{range $p, $b := .NetworkSettings.Ports}}{{$p}}->{{(index $b 0).HostPort}} {{end}}' 2>/dev/null)
  echo -e "  ${GREEN}✓ 前端镜像: ${FRONTEND_IMAGE}${NC}"
  echo -e "  ${GREEN}✓ 前端端口: ${FRONTEND_PORTS}${NC}"
fi

# 提取 MySQL 配置
if [ "$has_mysql" = "true" ]; then
  MYSQL_IMAGE=$(docker inspect "$MYSQL_CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)
  MYSQL_PORTS=$(docker inspect "$MYSQL_CONTAINER" --format '{{range $p, $b := .NetworkSettings.Ports}}{{$p}}->{{(index $b 0).HostPort}} {{end}}' 2>/dev/null)
  echo -e "  ${GREEN}✓ MySQL 镜像: ${MYSQL_IMAGE}${NC}"
fi

# 列出数据卷
echo -e "\n  ${BOLD}数据卷（升级后保留）:${NC}"
docker volume ls --format '  {{.Name}}' | grep -i kanle 2>/dev/null || echo "  (未找到 kanle 数据卷)"

# ============================================================
# [3] 备份数据（数据库 + 上传文件 + 插件）
# ============================================================
if [ "$SKIP_BACKUP" = "false" ]; then
  echo -e "\n${CYAN}[3/6]${NC} 备份数据（数据库 + 文件）..."
  mkdir -p "$BACKUP_DIR"
  BACKUP_TS=$(date +%Y%m%d-%H%M%S)

  # --- 3a. 数据库备份 ---
  if [ "$has_mysql" = "true" ]; then
    BACKUP_FILE="$BACKUP_DIR/db-${BACKUP_TS}.sql.gz"
    DB_NAME_VAL=$(echo "$BACKEND_ENV" | grep '^DB_NAME=' | cut -d= -f2)
    DB_USER_VAL=$(echo "$BACKEND_ENV" | grep '^DB_USER=' | cut -d= -f2)
    DB_PASSWORD_VAL=$(echo "$BACKEND_ENV" | grep '^DB_PASSWORD=' | cut -d= -f2)

    if [ -n "$DB_NAME_VAL" ] && [ -n "$DB_USER_VAL" ]; then
      echo -e "  ${YELLOW}备份数据库 ${DB_NAME_VAL}...${NC}"
      docker exec "$MYSQL_CONTAINER" mysqldump \
        -u"$DB_USER_VAL" \
        -p"$DB_PASSWORD_VAL" \
        --single-transaction \
        --quick \
        "$DB_NAME_VAL" 2>/dev/null | gzip > "$BACKUP_FILE"

      if [ -s "$BACKUP_FILE" ]; then
        DB_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo -e "  ${GREEN}✓ 数据库: ${BACKUP_FILE} (${DB_SIZE})${NC}"
      else
        echo -e "  ${YELLOW}⚠️  数据库备份为空（容器未启动或密码错误），跳过${NC}"
        rm -f "$BACKUP_FILE"
      fi
    else
      echo -e "  ${YELLOW}⚠️  无法提取数据库配置，跳过数据库备份${NC}"
    fi
  fi

  # --- 3b. 上传文件备份（图片/视频/音频）---
  if [ "$has_backend" = "true" ]; then
    UPLOADS_BACKUP="$BACKUP_DIR/uploads-${BACKUP_TS}.tar.gz"
    echo -e "  ${YELLOW}备份上传文件（图片/视频/音频）...${NC}"

    # 优先尝试从容器内 /app/public/uploads 导出
    if docker exec "$BACKEND_CONTAINER" test -d /app/public/uploads 2>/dev/null; then
      docker exec "$BACKEND_CONTAINER" tar czf - -C /app/public/uploads . 2>/dev/null > "$UPLOADS_BACKUP"
      if [ -s "$UPLOADS_BACKUP" ]; then
        UPLOADS_SIZE=$(du -h "$UPLOADS_BACKUP" | cut -f1)
        UPLOADS_COUNT=$(docker exec "$BACKEND_CONTAINER" find /app/public/uploads -type f 2>/dev/null | wc -l)
        echo -e "  ${GREEN}✓ 上传文件: ${UPLOADS_BACKUP} (${UPLOADS_SIZE}, ${UPLOADS_COUNT} 个文件)${NC}"
      else
        echo -e "  ${YELLOW}⚠️  上传文件备份为空${NC}"
        rm -f "$UPLOADS_BACKUP"
      fi
    else
      echo -e "  ${YELLOW}⚠️  容器内未找到 /app/public/uploads 目录，跳过${NC}"
    fi

    # --- 3c. 插件备份 ---
    PLUGINS_BACKUP="$BACKUP_DIR/plugins-${BACKUP_TS}.tar.gz"
    if docker exec "$BACKEND_CONTAINER" test -d /app/plugins 2>/dev/null; then
      echo -e "  ${YELLOW}备份插件...${NC}"
      docker exec "$BACKEND_CONTAINER" tar czf - -C /app/plugins . 2>/dev/null > "$PLUGINS_BACKUP"
      if [ -s "$PLUGINS_BACKUP" ]; then
        PLUGINS_SIZE=$(du -h "$PLUGINS_BACKUP" | cut -f1)
        echo -e "  ${GREEN}✓ 插件: ${PLUGINS_BACKUP} (${PLUGINS_SIZE})${NC}"
      else
        rm -f "$PLUGINS_BACKUP"
      fi
    fi
  fi

  # 备份摘要
  echo -e "\n  ${BOLD}备份摘要:${NC}"
  ls -lh "$BACKUP_DIR"/*-"$BACKUP_TS".* 2>/dev/null | awk '{printf "  %s %s\n", $5, $9}' || echo "  (无备份文件)"
else
  echo -e "\n${CYAN}[3/6]${NC} 跳过备份${NC}"
fi

# ============================================================
# [4] 确认升级
# ============================================================
echo -e "\n${CYAN}[4/6]${NC} 确认升级"
echo -e "  ${BOLD}----------------------------------------${NC}"
echo -e "  升级将执行以下操作:"
echo -e "  1. 拉取最新镜像"
echo -e "  2. 停止并删除旧容器"
echo -e "  3. 用相同配置启动新容器"
echo -e "  4. ${GREEN}数据卷不会被删除${NC}（数据库、上传文件、插件全部保留）"
echo -e ""
echo -e "  ${BOLD}已备份内容:${NC}"
if [ "$SKIP_BACKUP" = "false" ] && [ -d "$BACKUP_DIR" ]; then
  echo -e "  数据库:   backup/db-*.sql.gz"
  echo -e "  上传文件: backup/uploads-*.tar.gz (图片/视频/音频)"
  echo -e "  插件:     backup/plugins-*.tar.gz"
else
  echo -e "  ${YELLOW}(跳过了备份)${NC}"
fi
echo -e "  ${BOLD}----------------------------------------${NC}"

if [ "$AUTO_MODE" = "false" ]; then
  read -p "$(echo -e "\n  ${BOLD}确认升级？[Y/n]${NC}: ")" CONFIRM
  CONFIRM=$(echo "${CONFIRM:-Y}" | tr '[:upper:]' '[:lower:]')
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "yes" ]; then
    echo -e "  ${YELLOW}已取消升级${NC}"
    exit 0
  fi
fi

# ============================================================
# [5] 拉取镜像 + 重建容器
# ============================================================
echo -e "\n${CYAN}[5/6]${NC} 拉取最新镜像..."

if [ "$has_frontend" = "true" ]; then
  docker pull "$FRONTEND_IMAGE" 2>&1 | grep -E 'Pull|Download|Digest|Status|Already' | sed 's/^/  /'
fi
if [ "$has_backend" = "true" ]; then
  docker pull "$BACKEND_IMAGE" 2>&1 | grep -E 'Pull|Download|Digest|Status|Already' | sed 's/^/  /'
fi
echo -e "  ${GREEN}✓ 镜像拉取完成${NC}"

# --- 方式 A: docker compose ---
if [ "$use_compose" = "true" ]; then
  echo -e "\n  ${YELLOW}使用 docker compose 重建...${NC}"
  docker compose up -d --force-recreate 2>&1 | sed 's/^/  /'
  echo -e "  ${GREEN}✓ docker compose 重建完成${NC}"

# --- 方式 B: docker run（从提取的配置重建）---
else
  echo -e "\n  ${YELLOW}使用 docker run 重建...${NC}"

  # 重建后端
  if [ "$has_backend" = "true" ]; then
    echo -e "  重建后端..."
    docker stop "$BACKEND_CONTAINER" 2>/dev/null
    docker rm "$BACKEND_CONTAINER" 2>/dev/null

    # 构建环境变量参数
    ENV_ARGS=()
    while IFS= read -r line; do
      [ -n "$line" ] && ENV_ARGS+=(-e "$line")
    done <<< "$BACKEND_ENV"

    # 构建 volume 参数
    VOL_ARGS=()
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      IFS=':' read -r vol_type vol_name vol_dest <<< "$line"
      if [ "$vol_type" = "volume" ] && [ -n "$vol_name" ] && [ -n "$vol_dest" ]; then
        VOL_ARGS+=(-v "${vol_name}:${vol_dest}")
      elif [ "$vol_type" = "bind" ] && [ -n "$vol_name" ] && [ -n "$vol_dest" ]; then
        VOL_ARGS+=(-v "${vol_name}:${vol_dest}")
      fi
    done <<< "$BACKEND_VOLUMES"

    # 检查是否需要 add-host
    ADD_HOST_ARGS=()
    if echo "$BACKEND_ENV" | grep -q 'host.docker.internal'; then
      ADD_HOST_ARGS=(--add-host=host.docker.internal:host-gateway)
    fi

    docker run -d \
      --name "$BACKEND_CONTAINER" \
      --network "$BACKEND_NETWORK" \
      "${ADD_HOST_ARGS[@]}" \
      "${ENV_ARGS[@]}" \
      "${VOL_ARGS[@]}" \
      --restart unless-stopped \
      "$BACKEND_IMAGE" >/dev/null
    echo -e "    ${GREEN}✓ 后端已重建${NC}"
  fi

  # 重建前端
  if [ "$has_frontend" = "true" ]; then
    echo -e "  重建前端..."
    docker stop "$FRONTEND_CONTAINER" 2>/dev/null
    docker rm "$FRONTEND_CONTAINER" 2>/dev/null

    # 提取端口映射
    HOST_PORT=$(echo "$FRONTEND_PORTS" | grep -oP '3000/tcp->\K\d+' || echo "3000")

    # 构建环境变量参数
    ENV_ARGS=()
    while IFS= read -r line; do
      [ -n "$line" ] && ENV_ARGS+=(-e "$line")
    done <<< "$FRONTEND_ENV"

    docker run -d \
      --name "$FRONTEND_CONTAINER" \
      --network "$FRONTEND_NETWORK" \
      "${ENV_ARGS[@]}" \
      -p "${HOST_PORT}:3000" \
      --restart unless-stopped \
      "$FRONTEND_IMAGE" >/dev/null
    echo -e "    ${GREEN}✓ 前端已重建${NC}"
  fi
fi

# ============================================================
# [6] 验证 + 完成
# ============================================================
echo -e "\n${CYAN}[6/6]${NC} 验证升级..."

sleep 3

# 检查容器状态
ALL_OK=true
for c in "$BACKEND_CONTAINER" "$FRONTEND_CONTAINER"; do
  STATUS=$(docker inspect "$c" --format '{{.State.Status}}' 2>/dev/null)
  if [ "$STATUS" = "running" ]; then
    echo -e "  ${GREEN}✓ ${c}: running${NC}"
  else
    echo -e "  ${RED}✗ ${c}: ${STATUS:-not found}${NC}"
    ALL_OK=false
  fi
done

if [ "$has_mysql" = "true" ]; then
  STATUS=$(docker inspect "$MYSQL_CONTAINER" --format '{{.State.Status}}' 2>/dev/null)
  if [ "$STATUS" = "running" ]; then
    echo -e "  ${GREEN}✓ ${MYSQL_CONTAINER}: running${NC}"
  fi
fi

# 确认数据卷仍存在
echo -e "\n  ${BOLD}数据卷确认:${NC}"
docker volume ls --format '  {{.Name}}' | grep -i kanle 2>/dev/null || echo "  (无)"

echo ""
if [ "$ALL_OK" = "true" ]; then
  echo -e "${GREEN}${BOLD}  ✅ 升级完成!${NC}"
else
  echo -e "${RED}${BOLD}  ⚠️  部分容器未正常运行，请检查日志:${NC}"
  echo -e "  docker logs $FRONTEND_CONTAINER"
  echo -e "  docker logs $BACKEND_CONTAINER"
fi
echo ""
echo -e "${BOLD}常用命令:${NC}"
echo "  查看状态:  docker ps"
echo "  前端日志:  docker logs -f $FRONTEND_CONTAINER"
echo "  后端日志:  docker logs -f $BACKEND_CONTAINER"
if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
  echo ""
  echo -e "${BOLD}备份文件恢复命令:${NC}"
  echo -e "  ${BOLD}# 恢复数据库:${NC}"
  echo "  gunzip < backup/db-xxx.sql.gz | docker exec -i $MYSQL_CONTAINER mysql -u用户名 -p密码 数据库名"
  echo -e "  ${BOLD}# 恢复上传文件:${NC}"
  echo "  docker exec -i $BACKEND_CONTAINER tar xzf - -C /app/public/uploads < backup/uploads-xxx.tar.gz"
  echo -e "  ${BOLD}# 恢复插件:${NC}"
  echo "  docker exec -i $BACKEND_CONTAINER tar xzf - -C /app/plugins < backup/plugins-xxx.tar.gz"
fi
echo ""

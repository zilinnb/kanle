# kanle · 朋友圈博客

一个像微信朋友圈一样的个人博客系统。发动态、写文章、评论点赞、音乐播放、邮件通知，所有功能开箱即用。

## 功能特性

### 朋友圈动态
- 发图文动态，支持单图/多图（最多 9 图，微信式拼图）
- 发视频动态，弹窗播放器（支持 B 站等外链，全屏/进度条）
- 发 Live Photo 实况图，长按播放视频，默认有声
- 发音乐动态，浮窗播放器可拖拽
- 发链接卡片，自动抓取标题/描述/封面
- 发豆瓣影单卡片，电影/图书/音乐
- 地理位置定位（高德地图）
- 滑动切换图片，双击放大，捏合缩放

### 文章系统
- 富文本编辑器（标题/列表/代码/引用/图片/表情）
- 文章目录、封面、标签
- 归档页时间线，微信式正方形图片拼图

### 豆瓣影单
- 同步豆瓣电影/图书/音乐
- 分页加载 + 骨架屏
- 侧栏展示，支持全部/看过/在看/想看筛选

### 评论互动
- 微信公众号式评论楼层
- 回复折叠，表情包，点赞
- 评论邮件通知（微信聊天式模板）
- 已登录用户免填信息

### 音乐播放器
- 基于 MusicFree 插件
- 支持酷狗/QQ/网易云/酷我/咪咕等音源
- 浮窗卡片可拖拽，歌词面板
- 播放列表，切歌，静音

### 后台管理
- 仪表盘：数据统计概览
- 动态管理：发布/编辑/删除
- 评论管理：审核/回复/删除
- 媒体管理：图片/视频库
- 友链管理：增删改查，随机排序
- 影单管理：豆瓣同步
- 音乐管理：插件/播放列表
- 广告管理：侧栏广告位
- 黑名单：IP 防刷
- 站点设置：SMTP/又拍云/高德地图/豆瓣/RSS
- 夜间模式适配，移动端侧滑栏

### 其他特性
- **夜间模式** — 手动切换，记忆偏好，全组件适配
- **响应式设计** — 桌面/移动端完美适配
- **又拍云存储** — 一键切换本地/CDN
- **RSS 订阅** — 自动生成 Feed
- **SEO 优化** — SSR + OG 标签

## 技术栈

| | 技术 |
|---|---|
| 前端 | Next.js 16 · React 19 · Tailwind CSS v4 · Zustand |
| 后端 | Express 5 · Sequelize 6 · TypeScript 6 |
| 数据库 | MySQL 5.7 / 8.0 |
| 部署 | Docker Compose / Docker CLI / PM2 + Nginx |

## 快速部署

### 方式一：Docker CLI 交互式脚本（推荐）

下载脚本运行，按提示交互输入配置即可，**全部参数都支持回车采用默认值**：

```bash
# 1. 下载脚本
curl -sL https://raw.githubusercontent.com/zilinnb/kanle/main/deploy/docker-cli.sh -o docker-cli.sh

# 2. 运行（按提示输入，回车 = 默认值）
bash docker-cli.sh
```

交互流程示例：

```
========================================
  kanle · Docker 交互式部署
========================================

[1/5] MySQL 配置
  是否使用宿主机已安装的 MySQL（如宝塔面板自带的）？[y/N]: y
  数据库主机地址 [host.docker.internal]:         ← 回车用默认
  数据库端口 [3306]:                              ← 回车用默认
  数据库名 [moment_blog]: kanle                   ← 输入你的库名
  数据库用户名 [kanle]:                           ← 回车用默认
  数据库密码（必填，不回显）: ********             ← 输入密码

[2/5] 端口配置
  前端访问端口 [3000]:                            ← 回车用默认
  后端 API 端口 [4000]:                           ← 回车用默认

[3/5] 管理员配置
  管理员用户名 [admin]:                           ← 回车用默认
  管理员邮箱 [admin@kanle.net]:                   ← 回车用默认
  管理员密码 [123456]:                            ← 回车用默认

[4/5] JWT 密钥
  JWT 密钥（回车自动生成）:                       ← 回车自动生成

[5/5] 确认配置
  ...（打印所有配置）
  确认部署？[Y/n]:                                ← 回车确认
```

**两种 MySQL 模式**：
- **Docker 容器模式**（默认，回车 N）：开箱即用，脚本自动拉起 MySQL 容器，数据库密码可回车自动生成
- **宿主机 MySQL 模式**（输入 y）：适配宝塔面板等已装 MySQL 的场景，脚本跳过 MySQL 容器，backend 容器通过 `host.docker.internal` 连接宿主机

> 脚本支持重复运行：已存在的容器会跳过，删除后重建只需 `docker rm -f kanle-frontend kanle-backend kanle-mysql` 再运行。
> 自动化部署（CI/重复部署）可加 `--no-prompt` 参数跳过交互，全部采用默认值。

<details>
<summary>🖥️ 选择「宿主机 MySQL」模式时，宝塔面板需要先做这些操作</summary>

运行脚本前，在宝塔面板完成以下配置（否则容器连不上数据库）：

1. **创建数据库**：宝塔 → 数据库 → 添加数据库
   - 数据库名：和脚本交互时输入的「数据库名」一致（如 `moment_blog`）
   - 用户名：和脚本交互时输入的「数据库用户名」一致（如 `kanle`）
   - 密码：自定义强密码（运行脚本时输入同样的密码）
   - 访问权限：**所有人**（必须！容器来源 IP 是 172.17.0.1，选「本地服务器」会被拒绝）
   - 字符集：`utf8mb4`

2. **放行 3306 端口**：宝塔 → 安全 → 放行 3306
   - 安全起见可限制来源 IP 为 `172.17.0.0/16`（Docker 默认网段）

3. **如果之前跑过 Docker 容器模式**，会有旧的 `kanle-mysql` 容器占着 3306 端口，先删除它：
   ```bash
   docker rm -f kanle-mysql
   ```

4. 运行 `bash docker-cli.sh`，第 1 步选 `y`，按提示输入宿主机 MySQL 信息即可。

**数据库主机地址怎么填？**

| 场景 | 填什么 |
|---|---|
| 同机部署（推荐） | `host.docker.internal`（脚本自动加 host-gateway） |
| host.docker.internal 不生效 | `172.17.0.1`（Docker 默认网桥的宿主机 IP） |
| 跨机器部署 | 宿主机内网/公网 IP（如 `192.168.1.100`） |

</details>

### 方式二：Docker Compose

```bash
# 1. 下载配置文件
curl -sL https://raw.githubusercontent.com/zilinnb/kanle/main/docker-compose.yml -o docker-compose.yml
curl -sL https://raw.githubusercontent.com/zilinnb/kanle/main/.env.example -o .env

# 2. 修改 .env（至少修改 DB_PASSWORD、JWT_SECRET）
vi .env

# 3. 一键启动
docker compose up -d

# 4. 查看日志
docker compose logs -f
```

### 方式三：Docker CLI 手动命令

不想用脚本或 yml？用 `docker run` 命令逐个启动，完全自定义：

```bash
# 1. 创建网络
docker network create kanle-net

# 2. 启动 MySQL（替换 your_db_password）
docker run -d \
  --name kanle-mysql \
  --network kanle-net \
  -e MYSQL_ROOT_PASSWORD=your_db_password \
  -e MYSQL_DATABASE=moment_blog \
  -e MYSQL_USER=kanle \
  -e MYSQL_PASSWORD=your_db_password \
  -v kanle-mysql-data:/var/lib/mysql \
  --restart unless-stopped \
  mysql:8.0

# 3. 启动后端（替换 your_db_password、your_jwt_secret）
# 也可用 mysql:5.7 替代上面步骤 2 中的 mysql:8.0
docker run -d \
  --name kanle-backend \
  --network kanle-net \
  -e DB_HOST=kanle-mysql \
  -e DB_USER=kanle \
  -e DB_PASSWORD=your_db_password \
  -e DB_NAME=moment_blog \
  -e JWT_SECRET=your_jwt_secret \
  -e ADMIN_EMAIL=admin@kanle.net \
  -e ADMIN_PASSWORD=123456 \
  -e ADMIN_USERNAME=admin \
  -e CLIENT_URL=http://localhost:3000 \
  -e REVALIDATE_SECRET=kanle-revalidate \
  -p 4000:4000 \
  -v kanle-uploads:/app/backend/public/uploads \
  -v kanle-plugins:/app/backend/plugins \
  --restart unless-stopped \
  zilinnb/kanle-backend:latest

# 4. 启动前端（自定义端口示例：-p 8080:3000 把前端映射到 8080）
docker run -d \
  --name kanle-frontend \
  --network kanle-net \
  -e REVALIDATE_SECRET=kanle-revalidate \
  -p 3000:3000 \
  --restart unless-stopped \
  zilinnb/kanle-frontend:latest
```

常用操作：

```bash
# 查看日志
docker logs -f kanle-backend
docker logs -f kanle-frontend

# 停止
docker stop kanle-frontend kanle-backend kanle-mysql

# 启动（已创建的容器）
docker start kanle-mysql kanle-backend kanle-frontend

# 删除容器（数据保留在 volume 中）
docker rm -f kanle-frontend kanle-backend kanle-mysql
```

镜像标签可选：
- `latest`：稳定版
- `dev`：开发版，功能前沿但相对不稳定

### 方式四：从源码构建（自定义域名时使用）

预构建镜像中 `NEXT_PUBLIC_API_URL=http://localhost:4000/api`，适合本地体验。生产环境使用域名时需从源码构建：

```bash
# 1. 克隆项目
git clone https://github.com/zilinnb/kanle.git
cd kanle

# 2. 复制并修改环境变量
cp .env.example .env
# 编辑 .env，修改 NEXT_PUBLIC_API_URL 为你的域名（如 https://yourdomain.com/api）

# 3. 修改 docker-compose.yml：注释掉 frontend 的 image 行，取消 build 注释
# 4. 构建并启动
docker compose up -d --build
```

### 方式五：手动部署（PM2 + Nginx）

前置要求：Node.js 22 LTS、MySQL 5.7+、PM2、Nginx、pnpm

```bash
# 一次性安装 pnpm（Node 16+ 自带 corepack）
corepack enable && corepack prepare pnpm@latest --activate
# 或: npm install -g pnpm

# ===== 后端 =====
cd backend
pnpm install                  # 比 npm ci 快很多，磁盘占用小
cp .env.example .env          # 编辑 .env，填写数据库等信息
pnpm build
pnpm db:seed                  # 初始化数据库 + 创建管理员
pm2 start ecosystem.config.js

# ===== 前端 =====
cd frontend
pnpm install
cp .env.example .env.local    # 编辑 .env.local，填写 NEXT_PUBLIC_API_URL
pnpm build
pm2 start ecosystem.config.js

# ===== Nginx =====
# 参考 deploy/nginx.conf，/api/ 和 /uploads/ 代理到 4000，其余代理到 3000
sudo cp deploy/nginx.conf /etc/nginx/conf.d/kanle.conf
sudo nginx -t && sudo nginx -s reload
sudo certbot --nginx -d yourdomain.com   # SSL 证书
```

### 方式六：宝塔面板部署

适合使用宝塔面板（BT Panel）管理服务器的用户，全程图形化操作 + 少量终端命令。

#### 第 1 步：安装宝塔面板

如果服务器尚未安装宝塔面板：

```bash
# CentOS/Ubuntu/Debian 通用安装命令
curl -sSO https://download.bt.cn/install/install_panel.sh && bash install_panel.sh
```

安装完成后，浏览器打开宝塔面板地址，登录后在弹出的「推荐安装套件」中选择 **LNMP（推荐）**：
- **Nginx**：选 1.24 或以上
- **MySQL**：选 5.7 或 8.0 均可
- **PHP**：不需要，本项目基于 Node.js，可跳过
- 勾选「编译安装」，点击「一键安装」

#### 第 2 步：安装 Node.js + PM2 + pnpm

1. 宝塔左侧菜单 → **软件商店**
2. 搜索 **PM2管理器**，点击安装
3. 安装完成后，在 PM2 管理器中设置 Node.js 版本为 **22.x**
4. 在宝塔**终端**中启用 pnpm（Node 16+ 自带 corepack，一次性操作）：

```bash
corepack enable && corepack prepare pnpm@latest --activate
# 验证
pnpm -v
```

> PM2 管理器自带 Node.js 和 PM2，无需手动安装。pnpm 通过 corepack 启用，比 npm 快很多、报错更少。

#### 第 3 步：创建数据库

1. 宝塔左侧菜单 → **数据库** → **添加数据库**
2. 填写：
   - 数据库名：`moment_blog`
   - 用户名：`kanle`
   - 密码：自定义一个强密码（记下来，后面要用）
   - 访问权限：**本地服务器**
   - 字符集：`utf8mb4`
3. 点击**提交**

#### 第 4 步：克隆代码

宝塔左侧菜单 → **终端**，执行：

```bash
cd /www/wwwroot
git clone https://gitee.com/ziln_cn/kanle.git
# 如果用 GitHub: git clone https://github.com/zilinnb/kanle.git
```

> 也可通过宝塔**文件管理**上传代码压缩包再解压到 `/www/wwwroot/kanle`。

#### 第 5 步：部署后端

终端中执行：

```bash
cd /www/wwwroot/kanle/backend

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
```

编辑 `.env` 文件（终端中 `vi .env` 或用宝塔文件管理器编辑）：

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=kanle
DB_PASSWORD=你刚才设置的数据库密码
DB_NAME=moment_blog
JWT_SECRET=改成一串随机长字符串
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@kanle.net
ADMIN_PASSWORD=123456
ADMIN_USERNAME=admin
CLIENT_URL=http://localhost:3000
REVALIDATE_SECRET=kanle-revalidate
```

继续构建和初始化：

```bash
pnpm build
pnpm db:seed    # 初始化数据库表 + 创建管理员账号
```

用 PM2 启动后端：

```bash
pm2 start ecosystem.config.js --name kanle-backend
pm2 save
```

验证后端是否正常：

```bash
curl http://localhost:4000/api/health
# 返回 JSON 即正常
```

#### 第 6 步：部署前端

```bash
cd /www/wwwroot/kanle/frontend

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
```

编辑 `.env.local`：

```ini
# 本地部署用 localhost，有域名改成 https://你的域名/api
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_REVALIDATE_SECRET=kanle-revalidate
REVALIDATE_SECRET=kanle-revalidate
```

构建并启动：

```bash
pnpm build
pm2 start ecosystem.config.js --name kanle-frontend
pm2 save
```

验证前端：

```bash
curl http://localhost:3000
# 返回 HTML 即正常
```

#### 第 7 步：配置网站（Nginx 反向代理）

1. 宝塔左侧菜单 → **网站** → **添加站点**
2. 填写：
   - 域名：`你的域名.com`（没有域名可填服务器 IP）
   - 根目录：`/www/wwwroot/kanle/frontend`（随便填，后面会改）
   - PHP版本：**纯静态**
   - 数据库：不创建
3. 点击**提交**

站点创建后，点击站点名 → **配置文件**，替换为以下内容：

```nginx
# /www/server/panel/vhost/nginx/你的域名.conf

server {
    listen 80;
    server_name 你的域名.com;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 上传文件
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
    }

    # 上传文件大小限制
    client_max_body_size 50m;
}
```

保存后，终端执行 `nginx -t && nginx -s reload` 重载 Nginx。

> 如果用的是域名，宝塔会自动创建对应的 Nginx 配置文件，直接在站点设置里编辑即可。

#### 第 8 步：配置 SSL 证书（可选，有域名时推荐）

1. 宝塔 → **网站** → 点击站点名 → **SSL**
2. 选择 **Let's Encrypt** → 勾选域名 → 点击**申请**
3. 申请成功后，开启**强制 HTTPS**

> 宝塔会自动续期 Let's Encrypt 证书。

#### 第 9 步：设置防火墙

1. 宝塔 → **安全** → 放行端口
2. 确保放行：**80**（HTTP）、**443**（HTTPS）
3. **不需要**放行 3000 和 4000（Nginx 反向代理，外部不直接访问）

> 云服务器还需在云服务商控制台的安全组中放行 80 和 443。

#### 第 10 步：设置 PM2 开机自启

```bash
pm2 startup
pm2 save
```

宝塔 → **软件商店** → PM2 管理器 → 设置 → 勾选**开机自启**。

#### 常见问题

**Q: 宝塔终端中 npm/node/pnpm 命令找不到？**

宝塔的 PM2 管理器安装的 Node.js 可能不在默认 PATH 中。执行：

```bash
# 查找 node 路径
which node || find /www -name node -type f 2>/dev/null

# 添加到 PATH（写入 ~/.bashrc）
echo 'export PATH="/www/server/nodejs/v22/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 重新启用 pnpm
corepack enable && corepack prepare pnpm@latest --activate
```

**Q: 前端构建时内存不足？**

```bash
# 增加 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=2048"
pnpm build
```

**Q: 改了域名后前端没生效？**

`NEXT_PUBLIC_API_URL` 是构建时内联的，换域名后需要重新构建：

```bash
cd /www/wwwroot/kanle/frontend
# 修改 .env.local 中的 NEXT_PUBLIC_API_URL
pnpm build
pm2 restart kanle-frontend
```

**Q: 如何查看日志？**

```bash
pm2 logs kanle-backend      # 后端日志
pm2 logs kanle-frontend     # 前端日志
# 或在宝塔 PM2 管理器中直接查看
```

### 访问

启动完成后：
- 前端：http://localhost:3000
- 后台：http://localhost:3000/admin/login
- 默认账号：`admin`（用户名登录，也支持邮箱 `admin@kanle.net`）
- 默认密码：`123456`

> 生产环境务必修改 `ADMIN_PASSWORD`、`JWT_SECRET`、`DB_PASSWORD`。

## 环境变量

### 后端

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `DB_HOST` | 是 | `127.0.0.1` | MySQL 地址（Docker 中为 `kanle-mysql`）|
| `DB_PORT` | 否 | `3306` | MySQL 端口 |
| `DB_USER` | 是 | - | MySQL 用户名 |
| `DB_PASSWORD` | 是 | - | MySQL 密码 |
| `DB_NAME` | 否 | `moment_blog` | 数据库名 |
| `JWT_SECRET` | 是 | - | JWT 密钥（生产务必改为随机长字符串）|
| `JWT_EXPIRES_IN` | 否 | `7d` | Token 过期时间 |
| `ADMIN_EMAIL` | 是 | `admin@kanle.net` | 初始管理员邮箱（仅首次创建生效）|
| `ADMIN_PASSWORD` | 是 | `123456` | 初始管理员密码（仅首次创建生效）|
| `ADMIN_USERNAME` | 否 | `admin` | 管理员用户名 |
| `CLIENT_URL` | 否 | `http://localhost:3000` | 前端地址（CORS + revalidate）|
| `REVALIDATE_SECRET` | 否 | `kanle-revalidate` | 按需重验证密钥（须与前端一致）|

> **Docker 专属变量**（仅在 `.env` / `docker-compose.yml` 中使用）：
> `MYSQL_VERSION`（默认 `8.0`，可选 `5.7`）、`MYSQL_ROOT_PASSWORD`（默认 `rootpass`）

### 前端

| 变量 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | 构建时 | 是 | 后端 API 地址，**必须以 `/api` 结尾** |
| `NEXT_PUBLIC_TWIKOO_ENV_ID` | 构建时 | 否 | Twikoo 评论系统环境 ID |
| `REVALIDATE_SECRET` | 运行时 | 否 | 须与后端一致 |

> **重要**：`NEXT_PUBLIC_*` 变量在 `next build` 时内联到产物中，运行时修改无效。换域名后必须重新构建前端。

## 后台配置

登录后台管理面板（`/admin`）后设置以下功能：

| 功能 | 位置 | 说明 |
|---|---|---|
| SMTP 邮件 | 站点设置 → 邮件配置 | SMTP 服务器、端口、发件箱、可发送测试邮件 |
| 又拍云存储 | 站点设置 → 又拍云配置 | 服务名、操作员、CDN 域名，一键切换本地/CDN |
| 高德地图 | 站点设置 → 高德地图配置 | JS API Key + Web 服务 Key，[高德开放平台](https://lbs.amap.com/)申请 |
| 音乐插件 | 音乐管理 → 插件管理 | 上传 `.js` 插件或填写订阅 URL，支持酷狗/QQ/网易云/酷我 |
| 豆瓣影单 | 站点设置 → 豆瓣配置 | 豆瓣 ID，自动同步电影/图书/音乐 |
| 站点信息 | 站点设置 | 站点名称、Favicon、背景图、备案号、夜间模式、RSS |

## 常见问题

<details>
<summary>改了 NEXT_PUBLIC_API_URL 为什么没生效？</summary>

`NEXT_PUBLIC_*` 变量在构建时内联，运行时修改无效。需要重新构建前端：

```bash
docker compose up -d --build frontend           # Docker Compose
cd frontend && pnpm build && pm2 restart kanle-frontend  # 手动
```
</details>

<details>
<summary>发动态后刷新页面没看到更新？</summary>

检查三端 `REVALIDATE_SECRET` 是否一致：后端 `.env`、前端运行时、前端构建时的 `NEXT_PUBLIC_REVALIDATE_SECRET`。三者必须相同。
</details>

<details>
<summary>忘记管理员密码？</summary>

```bash
# 后端目录下执行，密码会重置为 .env 中的 ADMIN_PASSWORD
node dist/scripts/reset-password.js

# Docker 中执行
docker exec kanle-backend node dist/scripts/reset-password.js
```
</details>

<details>
<summary>MySQL 连不上？</summary>

- Docker Compose：`DB_HOST` 应为 `mysql`（service 名）
- Docker CLI：`DB_HOST` 应为 `kanle-mysql`（容器名）
- 手动部署：`DB_HOST` 应为 `127.0.0.1`
- 确认 MySQL 已启动且用户有权限
</details>

<details>
<summary>上传的图片显示不出来？</summary>

1. 检查 Nginx 是否将 `/uploads/` 代理到后端
2. 如果使用 CDN 域名，需在 `frontend/next.config.ts` 的 `images.remotePatterns` 中添加域名
</details>

<details>
<summary>如何自定义端口？</summary>

- Docker Compose：修改 `docker-compose.yml` 中的 `ports: - "3000:3000"` 和 `ports: - "4000:4000"`
- Docker CLI：`docker run -p 8080:3000`（前端映射到 8080）和 `-p 4001:4000`（后端映射到 4001）
</details>

## 开发

```bash
# 后端（热重载）
cd backend && pnpm dev

# 前端（热重载）
cd frontend && pnpm dev
```

项目使用 `sequelize.sync()` 自动创建表，无需手动迁移。

## License

[MIT](LICENSE)

Copyright (c) 2026 zilinnb

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
| 部署 | PM2 + Nginx |

---

## 部署教程（Debian 12 全新服务器）

本教程适用于一台全新的 Debian 12 服务器，从零开始安装所有依赖并部署 kanle。

### 前置条件

- 一台 Debian 12 服务器（root 或 sudo 权限）
- 一个域名（可选，没有也可用 IP 访问）
- 云服务商安全组放行 80 和 443 端口

### 代码仓库

kanle 在 GitHub 和 Gitee 上均有仓库，分为稳定版和开发版：

| 版本 | GitHub | Gitee |
|---|---|---|
| 稳定版（推荐） | `https://github.com/zilinnb/kanle.git` | `https://gitee.com/ziln_cn/kanle.git` |
| 开发版（功能前沿） | — | `https://gitee.com/ziln_cn/kanle-next.git` |

> 国内服务器推荐使用 Gitee，克隆速度更快。

### 第 1 步：系统更新

```bash
apt update && apt upgrade -y
apt install -y curl wget git vim build-essential
```

### 第 2 步：安装 Node.js 20 LTS

```bash
# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# 安装 Node.js
apt install -y nodejs

# 验证
node -v   # 应输出 v20.x.x
npm -v    # 应输出 10.x.x
```

### 第 3 步：启用 pnpm + 安装 PM2

```bash
# 启用 pnpm（Node 16+ 自带 corepack，一次性操作）
corepack enable
corepack prepare pnpm@latest --activate

# 全局安装 PM2
npm install -g pm2

# 验证
pnpm -v   # 应输出 10.x.x
pm2 -v    # 应输出 7.x.x
```

### 第 4 步：安装 MySQL

```bash
apt install -y mysql-server

# 启动并设置开机自启
systemctl start mysql
systemctl enable mysql

# 安全初始化（按提示设置 root 密码，其余选项一路 Y）
mysql_secure_installation
```

### 第 5 步：创建数据库

```bash
mysql -u root -p
```

```sql
CREATE DATABASE moment_blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kanle'@'localhost' IDENTIFIED BY '你的强密码';
GRANT ALL PRIVILEGES ON moment_blog.* TO 'kanle'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> 记住密码，后面配置 `.env` 时要用。

### 第 6 步：安装 Nginx

```bash
apt install -y nginx
systemctl enable nginx
```

### 第 7 步：克隆代码

```bash
# 安装路径（可自定义，后续 Nginx 配置需对应修改）
INSTALL_DIR=/opt/kanle

# 方式 A：从 Gitee 克隆（国内推荐）
git clone https://gitee.com/ziln_cn/kanle.git $INSTALL_DIR

# 方式 B：从 Gitee 克隆开发版
# git clone https://gitee.com/ziln_cn/kanle-next.git $INSTALL_DIR

# 方式 C：从 GitHub 克隆
# git clone https://github.com/zilinnb/kanle.git $INSTALL_DIR
```

### 第 8 步：部署后端

```bash
cd $INSTALL_DIR/backend

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
vim .env
```

编辑 `.env`，修改以下关键字段：

```ini
# MySQL（填入第 5 步设置的密码）
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=kanle
DB_PASSWORD=你的强密码
DB_NAME=moment_blog

# JWT 密钥（改为随机长字符串，可用 openssl rand -hex 32 生成）
JWT_SECRET=请改成一串随机长字符串

# 初始管理员（仅首次创建生效，之后修改不会更新已有账号）
ADMIN_EMAIL=admin@kanle.net
ADMIN_PASSWORD=123456
ADMIN_USERNAME=admin

# 前端地址（有域名填 https://你的域名.com，没域名填 http://服务器IP）
CLIENT_URL=http://localhost:3000

# 按需重验证密钥（须与前端一致，默认即可）
REVALIDATE_SECRET=kanle-revalidate
```

构建并初始化数据库：

```bash
# 编译 TypeScript
pnpm build

# 初始化数据库表 + 创建管理员账号
pnpm db:seed
```

用 PM2 启动：

```bash
pm2 start ecosystem.config.js
pm2 save
```

验证后端是否正常：

```bash
curl http://localhost:4000/api/health
# 返回 JSON 即正常
```

### 第 9 步：部署前端

```bash
cd $INSTALL_DIR/frontend

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
```

`.env.local` 默认内容通常无需修改，如有域名可设置 `NEXT_PUBLIC_SITE_URL`：

```ini
# 后端 API 地址（相对路径 /api，通过 Next.js rewrites 代理，任何域名/IP 通用）
NEXT_PUBLIC_API_URL=/api

# 后端地址（rewrites 代理目标）
BACKEND_URL=http://localhost:4000

# 站点 URL（可选，用于 Cravatar 默认头像，有域名可设为 https://你的域名.com）
NEXT_PUBLIC_SITE_URL=

# 按需重验证密钥（须与后端 REVALIDATE_SECRET 一致）
NEXT_PUBLIC_REVALIDATE_SECRET=kanle-revalidate
REVALIDATE_SECRET=kanle-revalidate

# standalone 服务监听
PORT=3000
HOSTNAME=0.0.0.0
```

构建并启动：

```bash
# 构建（standalone 模式，生成独立可运行产物）
pnpm build

# 复制静态资源到 standalone 目录（必须执行，否则页面样式丢失）
cp -r .next/static .next/standalone/.next/static

# 用 PM2 启动
pm2 start ecosystem.config.js
pm2 save
```

验证前端是否正常：

```bash
curl http://localhost:3000
# 返回 HTML 即正常
```

### 第 10 步：配置 Nginx 反向代理

```bash
# 复制项目提供的 Nginx 配置
cp $INSTALL_DIR/deploy/nginx.conf /etc/nginx/conf.d/kanle.conf

# 编辑配置，替换域名和安装路径
vim /etc/nginx/conf.d/kanle.conf
```

需要修改的内容：
- `server_name yourdomain.com` → 改为你的域名或 IP
- `/opt/kanle` → 改为你的实际安装路径（如果用的不是 `/opt/kanle`）

测试并重载 Nginx：

```bash
nginx -t
nginx -s reload
```

> **端口说明**：外部只需放行 80（HTTP）和 443（HTTPS）。前端 3000 和后端 4000 端口由 Nginx 反向代理，不需要对外暴露。

### 第 11 步：配置 SSL 证书（有域名时推荐）

```bash
# 安装 certbot
apt install -y certbot python3-certbot-nginx

# 申请证书并自动配置 Nginx
certbot --nginx -d 你的域名.com

# 测试自动续期
certbot renew --dry-run
```

### 第 12 步：配置防火墙

```bash
# 放行 HTTP 和 HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp     # SSH
ufw enable
```

> 云服务器还需在服务商控制台的安全组中放行 80 和 443。

### 第 13 步：设置 PM2 开机自启

```bash
pm2 startup
# 按提示执行输出的命令（通常是 systemctl enable pm2-root 之类）

pm2 save
```

---

### 访问

部署完成后，用 `http://你的域名.com` 或 `http://服务器IP` 打开：

- 前端首页：`http://你的域名`
- 后台管理：`http://你的域名/admin/login`
- 默认账号：`admin`（用户名登录，也支持邮箱 `admin@kanle.net`）
- 默认密码：`123456`

> 生产环境务必修改 `ADMIN_PASSWORD`、`JWT_SECRET`、`DB_PASSWORD`。

---

## 升级（保留数据）

```bash
cd $INSTALL_DIR

# 拉取最新代码
git pull

# 升级后端
cd backend
pnpm install
pnpm build
pm2 restart kanle-backend

# 升级前端
cd ../frontend
pnpm install
pnpm build
cp -r .next/static .next/standalone/.next/static
pm2 restart kanle-frontend
```

> 数据库表通过 `sequelize.sync()` 自动同步结构变更，无需手动迁移。后端重启时会自动执行。

## 环境变量

### 后端（`backend/.env`）

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `DB_HOST` | 是 | `127.0.0.1` | MySQL 地址 |
| `DB_PORT` | 否 | `3306` | MySQL 端口 |
| `DB_USER` | 是 | - | MySQL 用户名 |
| `DB_PASSWORD` | 是 | - | MySQL 密码 |
| `DB_NAME` | 否 | `moment_blog` | 数据库名 |
| `JWT_SECRET` | 是 | - | JWT 密钥（生产务必改为随机长字符串） |
| `JWT_EXPIRES_IN` | 否 | `7d` | Token 过期时间 |
| `ADMIN_EMAIL` | 是 | `admin@kanle.net` | 初始管理员邮箱（仅首次创建生效） |
| `ADMIN_PASSWORD` | 是 | `123456` | 初始管理员密码（仅首次创建生效） |
| `ADMIN_USERNAME` | 否 | `admin` | 管理员用户名 |
| `CLIENT_URL` | 否 | `http://localhost:3000` | 前端地址（CORS + revalidate 回调） |
| `REVALIDATE_SECRET` | 否 | `kanle-revalidate` | 按需重验证密钥（须与前端一致） |

### 前端（`frontend/.env.local`）

| 变量 | 必填 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | 是 | 后端 API 地址，默认 `/api`（相对路径，通过 rewrites 代理，通用） |
| `BACKEND_URL` | 是 | rewrites 代理目标，PM2 部署填 `http://localhost:4000` |
| `NEXT_PUBLIC_SITE_URL` | 否 | 站点 URL（用于 Cravatar 默认头像，不设则回退 wavatar） |
| `NEXT_PUBLIC_TWIKOO_ENV_ID` | 否 | Twikoo 评论系统环境 ID |
| `REVALIDATE_SECRET` | 否 | 须与后端一致 |

> `NEXT_PUBLIC_API_URL=/api` 是相对路径，换域名后**不需要重新构建**。

## 后台配置

登录后台管理面板（`/admin`）后设置以下功能：

| 功能 | 位置 | 说明 |
|---|---|---|
| SMTP 邮件 | 站点设置 → 邮件配置 | SMTP 服务器、端口、发件箱、可发送测试邮件 |
| 又拍云存储 | 站点设置 → 又拍云配置 | 服务名、操作员、CDN 域名，一键切换本地/CDN |
| 高德地图 | 站点设置 → 高德地图配置 | JS API Key + Web 服务 Key，[高德开放平台](https://lbs.amap.com/)申请 |
| 音乐插件 | 音乐管理 → 插件管理 | 上传 `.js` 插件或填写订阅 URL，支持酷狗/QQ/网易云/酷我 |
| 豆瓣影单 | 站点设置 → 豆瓣配置 | 豆瓣 ID，自动同步电影/图书/音乐 |
| 自动播放 | 音乐管理 → 进入网站自动播放 | 开启后访客进入网站自动播放歌单音乐 |
| 站点信息 | 站点设置 | 站点名称、Favicon、背景图、备案号、夜间模式、RSS |

## 常见问题

<details>
<summary>换了域名需要重新构建前端吗？</summary>

**不需要。** `NEXT_PUBLIC_API_URL=/api` 是相对路径，通过 Next.js rewrites 代理到后端，任何域名/IP 都通用。只需修改 Nginx 配置中的 `server_name`。
</details>

<details>
<summary>发动态后刷新页面没看到更新？</summary>

检查后端 `.env` 的 `REVALIDATE_SECRET` 与前端 `.env.local` 的 `REVALIDATE_SECRET` / `NEXT_PUBLIC_REVALIDATE_SECRET` 是否一致。
</details>

<details>
<summary>忘记管理员密码？</summary>

```bash
cd $INSTALL_DIR/backend
node dist/scripts/reset-password.js
```
密码会重置为 `.env` 中的 `ADMIN_PASSWORD`。
</details>

<details>
<summary>MySQL 连不上？</summary>

- 确认 MySQL 已启动：`systemctl status mysql`
- 确认用户有权限：`mysql -u kanle -p -e "SHOW DATABASES;"`
- 确认 `.env` 中 `DB_HOST` 为 `127.0.0.1`（不要用 `localhost`，某些系统下可能有差异）
</details>

<details>
<summary>上传的图片显示不出来？</summary>

- 确认 Nginx 配置中 `/uploads/` 的 `alias` 路径正确指向 `backend/public/uploads/`
- 确认后端 `public/uploads/` 目录存在且有读写权限
- 如使用 CDN 域名，需在 `frontend/next.config.ts` 的 `images.remotePatterns` 中添加域名
</details>

<details>
<summary>前端构建时内存不足？</summary>

```bash
export NODE_OPTIONS="--max-old-space-size=2048"
pnpm build
```
</details>

<details>
<summary>如何查看日志？</summary>

```bash
pm2 logs kanle-backend      # 后端日志
pm2 logs kanle-frontend     # 前端日志
pm2 logs                    # 所有日志
```
</details>

<details>
<summary>如何修改前端端口？</summary>

编辑 `frontend/ecosystem.config.js`，修改 `env.PORT` 的值，然后同步修改 Nginx 配置中 `location /` 的 `proxy_pass` 端口，最后 `pm2 restart kanle-frontend && nginx -s reload`。
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

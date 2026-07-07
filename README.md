# kanle · 朋友圈博客

一个像微信朋友圈一样的个人博客系统。发动态、写文章、评论点赞、音乐播放、邮件通知，所有功能开箱即用。

## 特性

- **朋友圈式动态** — 发图片、视频、音乐、链接卡片，支持 Live Photo
- **文章系统** — Markdown 富文本编辑，目录、封面、归档
- **评论互动** — 微信公众号式评论楼层，回复折叠，表情包，点赞
- **音乐播放器** — 基于 MusicFree 插件，支持酷狗/QQ/网易云/酷我等音源
- **邮件通知** — 微信聊天式邮件模板，评论/回复即时通知
- **又拍云存储** — 一键切换本地/CDN 存储
- **高德地图定位** — 发动态时附带地理位置
- **RSS 订阅** — 自动生成 RSS Feed
- **夜间模式** — 手动切换，记忆偏好
- **响应式设计** — 完美适配桌面和移动端
- **后台管理** — 动态/评论/媒体/友链/音乐/插件/站点设置

## 技术栈

| | 技术 |
|---|---|
| 前端 | Next.js 16 · React 19 · Tailwind CSS v4 · Zustand |
| 后端 | Express 5 · Sequelize 6 · TypeScript 6 |
| 数据库 | MySQL 8 |
| 进程管理 | PM2（手动部署）/ Docker Compose（容器部署）|

## 快速开始（Docker Compose 一键部署）

### 前置要求

- Docker 20+
- Docker Compose v2

### 步骤

```bash
# 1. 克隆项目
git clone https://github.com/zilinnb/kanle-next.git
cd kanle

# 2. 复制环境变量模板并修改
cp .env.example .env
# 编辑 .env，至少修改 DB_PASSWORD、JWT_SECRET、ADMIN_PASSWORD

# 3. 一键启动
docker compose up -d --build

# 4. 访问
# 前端: http://localhost:3000
# 后端 API: http://localhost:4000/api/health
```

默认管理员账号：
- 邮箱：`admin@example.com`（在 `.env` 中修改 `ADMIN_EMAIL`）
- 密码：`change-me`（在 `.env` 中修改 `ADMIN_PASSWORD`）

访问 `http://localhost:3000/admin/login` 进入后台管理。

> **重要**：修改 `NEXT_PUBLIC_API_URL` 后需要重新构建前端镜像：
> ```bash
> docker compose up -d --build frontend
> ```

## 手动部署（PM2 + Nginx）

### 前置要求

- Node.js 22 LTS
- MySQL 8.0
- PM2（`npm install -g pm2`）
- Nginx

### 后端

```bash
cd backend

# 安装依赖
npm ci

# 配置环境变量
cp .env.example .env
# 编辑 .env，填写数据库、JWT、管理员等信息

# 编译 TypeScript
npm run build

# 初始化数据库 + 创建管理员
npm run db:seed

# 启动（PM2）
pm2 start ecosystem.config.js
```

### 前端

```bash
cd frontend

# 安装依赖
npm ci

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填写 NEXT_PUBLIC_API_URL

# 构建
npm run build

# 启动（PM2）
pm2 start ecosystem.config.js
```

### Nginx 反向代理

参考 [deploy/nginx.conf](deploy/nginx.conf)，将 `/api/` 和 `/uploads/` 代理到后端（4000），其余代理到前端（3000）。

```bash
sudo cp deploy/nginx.conf /etc/nginx/conf.d/kanle.conf
# 修改 server_name 为你的域名
sudo nginx -t && sudo nginx -s reload

# SSL 证书
sudo certbot --nginx -d yourdomain.com
```

## 环境变量参考

### 后端

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `NODE_ENV` | 是 | `production` | 运行环境 |
| `PORT` | 否 | `4000` | 后端端口 |
| `DB_HOST` | 是 | `127.0.0.1` | MySQL 地址（Docker 中为 `mysql`）|
| `DB_PORT` | 否 | `3306` | MySQL 端口 |
| `DB_USER` | 是 | - | MySQL 用户名 |
| `DB_PASSWORD` | 是 | - | MySQL 密码 |
| `DB_NAME` | 否 | `moment_blog` | 数据库名 |
| `JWT_SECRET` | 是 | - | JWT 密钥（生产务必修改）|
| `JWT_EXPIRES_IN` | 否 | `7d` | Token 过期时间 |
| `ADMIN_EMAIL` | 是 | - | 初始管理员邮箱（仅首次创建生效）|
| `ADMIN_PASSWORD` | 是 | - | 初始管理员密码（仅首次创建生效）|
| `ADMIN_USERNAME` | 否 | `admin` | 管理员用户名 |
| `CLIENT_URL` | 否 | `http://localhost:3000` | 前端地址（CORS + revalidate）|
| `REVALIDATE_SECRET` | 否 | `kanle-revalidate` | 按需重验证密钥（须与前端一致）|

### 前端

| 变量 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | 构建时 | 是 | - | 后端 API 地址，**必须以 `/api` 结尾** |
| `NEXT_PUBLIC_TWIKOO_ENV_ID` | 构建时 | 否 | - | Twikoo 评论系统环境 ID |
| `NEXT_PUBLIC_REVALIDATE_SECRET` | 构建时 | 否 | `kanle-revalidate` | 须与后端一致 |
| `REVALIDATE_SECRET` | 运行时 | 否 | `kanle-revalidate` | 须与后端一致 |
| `PORT` | 运行时 | 否 | `3000` | 前端端口 |
| `HOSTNAME` | 运行时 | 否 | `0.0.0.0` | 监听地址 |

> **构建时变量**：`NEXT_PUBLIC_*` 前缀的变量在 `next build` 时内联到产物中，运行时修改无效。换域名后必须重新构建前端。

## 后台配置指南

以下功能不在环境变量中配置，登录后台管理面板（`/admin`）后设置：

### SMTP 邮件通知

后台 → 站点设置 → 邮件配置：
- SMTP 服务器、端口、是否 SSL
- 发件邮箱、密码/授权码
- 收件邮箱（默认为管理员邮箱）
- 可发送测试邮件验证

### 又拍云存储

后台 → 站点设置 → 又拍云配置：
- 服务名（bucket）、操作员、密码
- CDN 域名、存储路径
- 开启后上传文件走 CDN，关闭则本地存储

### 高德地图定位

后台 → 站点设置 → 高德地图配置：
- JS API Key（前端地图组件用）
- 安全密钥
- Web 服务 Key（后端地理编码用）
- 到[高德开放平台](https://lbs.amap.com/)申请，需「Web服务」类型的 Key

### 音乐源插件

后台 → 音乐管理 → 插件管理：
- 上传 `.js` 插件文件（MusicFree 格式）
- 或填写订阅 JSON URL 批量安装
- 支持酷狗、QQ、网易云、酷我、咪咕等音源
- 插件热重载，无需重启

### 站点信息

后台 → 站点设置：
- 站点名称、描述、域名、备案号
- Favicon、背景图、默认头像
- 夜间模式、RSS 开关

## 常见问题

### 改了 `NEXT_PUBLIC_API_URL` 为什么没生效？

`NEXT_PUBLIC_*` 变量在构建时内联，运行时修改无效。需要重新构建前端：

```bash
# Docker
docker compose up -d --build frontend

# 手动
cd frontend && npm run build && pm2 restart kanle-frontend
```

### 发动态后刷新页面没看到更新？

检查三端 `REVALIDATE_SECRET` 是否一致：
- 后端 `.env` 的 `REVALIDATE_SECRET`
- 前端运行时的 `REVALIDATE_SECRET`
- 前端构建时的 `NEXT_PUBLIC_REVALIDATE_SECRET`

三者必须相同，否则按需重验证失败。

### 上传的图片显示不出来？

1. 检查 Nginx 是否将 `/uploads/` 代理到后端
2. 如果使用 CDN 域名，需在 `frontend/next.config.ts` 的 `images.remotePatterns` 中添加域名

### 忘记管理员密码？

```bash
# 后端目录下执行
node dist/scripts/reset-password.js
```

### MySQL 连不上？

- Docker Compose：`DB_HOST` 应为 `mysql`（service 名）
- 手动部署：`DB_HOST` 应为 `127.0.0.1`
- 确认 MySQL 已启动且用户有权限

### Docker 中图片优化报错？

Alpine 镜像可能缺少 sharp 原生依赖。在 `next.config.ts` 中添加：

```typescript
images: {
  unoptimized: true,  // 关闭图片优化
}
```

### 本地 Docker 前端 SSR 元数据是默认值？

本地 Docker Compose 中，前端容器内 `localhost:4000` 指向容器自身，SSR 数据获取会回退到默认值。客户端功能不受影响。生产环境使用真实域名 + Nginx 反代即可正常。

## 开发指南

```bash
# 后端开发（热重载）
cd backend
npm run dev

# 前端开发（热重载）
cd frontend
npm run dev
```

### 数据库迁移

项目使用 `sequelize.sync()` 自动创建表，无需手动迁移。Schema 变更通过 SQL 手动管理，避免重复索引问题。

## License

[MIT](LICENSE)

Copyright (c) 2026 kanle

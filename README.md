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
- 富文本编辑器（标题/列表/代码/引用/图片）
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
| 数据库 | MySQL 8 |
| 部署 | Docker Compose（推荐）/ PM2 + Nginx |

## 快速部署

### 方式一：Docker Compose（推荐，5 分钟搞定）

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

启动完成后：
- 前端：http://localhost:3000
- 后台：http://localhost:3000/admin/login
- 默认账号：`admin@example.com`
- 默认密码：`123456`

镜像标签可选：
- `latest`：稳定版
- `dev`：开发版，功能前沿但相对不稳定

### 方式二：从源码构建（自定义域名时使用）

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

### 方式三：手动部署（PM2 + Nginx）

前置要求：Node.js 22 LTS、MySQL 8.0、PM2、Nginx

```bash
# ===== 后端 =====
cd backend
npm ci
cp .env.example .env          # 编辑 .env，填写数据库等信息
npm run build
npm run db:seed               # 初始化数据库 + 创建管理员
pm2 start ecosystem.config.js

# ===== 前端 =====
cd frontend
npm ci
cp .env.example .env.local    # 编辑 .env.local，填写 NEXT_PUBLIC_API_URL
npm run build
pm2 start ecosystem.config.js

# ===== Nginx =====
# 参考 deploy/nginx.conf，/api/ 和 /uploads/ 代理到 4000，其余代理到 3000
sudo cp deploy/nginx.conf /etc/nginx/conf.d/kanle.conf
sudo nginx -t && sudo nginx -s reload
sudo certbot --nginx -d yourdomain.com   # SSL 证书
```

## 环境变量

### 后端

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `DB_HOST` | 是 | `127.0.0.1` | MySQL 地址（Docker 中为 `mysql`）|
| `DB_PORT` | 否 | `3306` | MySQL 端口 |
| `DB_USER` | 是 | - | MySQL 用户名 |
| `DB_PASSWORD` | 是 | - | MySQL 密码 |
| `DB_NAME` | 否 | `moment_blog` | 数据库名 |
| `JWT_SECRET` | 是 | - | JWT 密钥（生产务必改为随机长字符串）|
| `JWT_EXPIRES_IN` | 否 | `7d` | Token 过期时间 |
| `ADMIN_EMAIL` | 是 | `admin@example.com` | 初始管理员邮箱（仅首次创建生效）|
| `ADMIN_PASSWORD` | 是 | `123456` | 初始管理员密码（仅首次创建生效）|
| `ADMIN_USERNAME` | 否 | `admin` | 管理员用户名 |
| `CLIENT_URL` | 否 | `http://localhost:3000` | 前端地址（CORS + revalidate）|
| `REVALIDATE_SECRET` | 否 | `kanle-revalidate` | 按需重验证密钥（须与前端一致）|

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
docker compose up -d --build frontend           # Docker
cd frontend && npm run build && pm2 restart kanle-frontend  # 手动
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
```
</details>

<details>
<summary>MySQL 连不上？</summary>

- Docker Compose：`DB_HOST` 应为 `mysql`（service 名）
- 手动部署：`DB_HOST` 应为 `127.0.0.1`
- 确认 MySQL 已启动且用户有权限
</details>

<details>
<summary>上传的图片显示不出来？</summary>

1. 检查 Nginx 是否将 `/uploads/` 代理到后端
2. 如果使用 CDN 域名，需在 `frontend/next.config.ts` 的 `images.remotePatterns` 中添加域名
</details>

## 开发

```bash
# 后端（热重载）
cd backend && npm run dev

# 前端（热重载）
cd frontend && npm run dev
```

项目使用 `sequelize.sync()` 自动创建表，无需手动迁移。

## License

[MIT](LICENSE)

Copyright (c) 2026 zilinnb

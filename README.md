# 境外服务器统一管控平台

轻量 Web SSH + SFTP 管控平台。当前版本实现文档中的 MVP 主线：登录认证、服务器资产管理、凭据加密、SSH 连接测试、Web SSH 终端、SFTP 文件管理、审计日志和 Docker 部署骨架。

## 技术栈

- Monorepo：pnpm workspace
- 前端：React + TypeScript + Vite + Ant Design + xterm.js
- 后端：Fastify + TypeScript + Prisma + PostgreSQL + ssh2 + ws
- 部署：Docker Compose

## 本地开发

1. 准备环境变量：

```bash
cp .env.example .env
```

`APP_MASTER_KEY` 建议使用 32 字节随机值的 base64：

```bash
openssl rand -base64 32
```

2. 启动依赖数据库：

```bash
docker compose up -d postgres redis
```

3. 安装依赖并初始化数据库：

```bash
corepack enable
pnpm install
pnpm --filter @server-panel/server prisma migrate dev --name init
pnpm seed
```

4. 启动开发服务：

```bash
pnpm dev
```

前端默认在 `http://localhost:5173`，后端默认在 `http://localhost:3000`。

默认管理员由 seed 创建：

- 用户名：`admin`
- 密码：`admin123456`

## 生产部署

推荐方式是在服务器上通过 Git 拉取代码，然后执行一键部署脚本：

```bash
git clone <你的仓库地址> server-panel
cd server-panel
sudo bash scripts/deploy.sh
```

脚本会自动完成：

- 检查 Docker 和 Docker Compose Plugin。
- 在 Ubuntu/Debian 上自动安装 Docker Engine。
- 首次部署时生成生产 `.env`，包含数据库密码、JWT 密钥、凭据加密主密钥和管理员密码。
- 构建并启动 app、PostgreSQL、Redis。
- 执行 Prisma migration。
- 初始化默认管理员。

部署完成后访问：

```text
http://<服务器IP>:3000
```

管理员账号和密码在服务器的 `.env` 文件中：

```bash
grep 'ADMIN_' .env
```

如果服务器已经安装好 Docker，也可以手动执行：

```bash
docker compose up -d --build
docker compose exec app pnpm seed
```

首次部署后请立即修改 `docker-compose.yml` 里的 `JWT_SECRET`、`APP_MASTER_KEY` 和默认管理员密码。生产环境的 `APP_MASTER_KEY` 必须是 base64 编码的 32 字节密钥，否则服务会拒绝启动。

## 已实现

- 管理员登录、JWT Access Token、可撤销 Refresh Token
- 默认管理员 seed
- 服务器新增、编辑、删除、列表、搜索、连接测试
- 服务器密码、私钥、passphrase AES-256-GCM 加密入库
- 登录、服务器操作、连接测试、终端、文件操作审计
- `/ws/ssh?serverId=xxx&token=JWT` Web SSH
- SFTP 目录浏览、上传、下载、重命名、删除、新建目录
- 前端登录页、仪表盘、服务器页、终端页、文件管理页、审计页、设置页

## 待办

- 细粒度服务器授权和服务器组管理 UI
- Refresh Token 自动静默刷新
- 文件管理目录删除二次输入确认与非空目录提示优化
- 登录限流、TOTP、IP 白名单
- 批量命令、监控、终端回放

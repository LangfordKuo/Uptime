# Uptime Monitor - 服务监控系统
> 云服务器推荐：https://lyew.com/

一个类似 UptimeRobot 的服务监控系统，支持 HTTP/HTTPS、TCP 端口、PING、Push 心跳、SSL 证书、域名到期、DNS、Docker 容器共 8 种监控类型，提供实时状态更新、可视化统计、故障通知和公开状态页展示。
<img width="2538" height="1285" alt="ScreenshotUptime" src="https://github.com/user-attachments/assets/d1275d1d-6915-4b74-866d-6d654d2ba791" />

## 功能特性

### 监控功能
- ✅ **8 种监控类型**：
  - HTTP/HTTPS（支持关键词检查、自定义状态码 `200,204,300-399`、自定义 Header）
  - TCP 端口、PING 网络检测
  - **Push 心跳**（被监控服务主动上报，超时判故障，适合备份任务监控）
  - **SSL 证书**有效期监控、**域名到期**监控（RDAP 协议）
  - **DNS** 解析检查（A/AAAA/CNAME/MX/TXT/NS + 期望值匹配）
  - **Docker** 容器状态监控（支持健康检查）
- ✅ **实时监控**：自定义检测间隔（最低 10 秒），创建后立即执行首次检测，实时 WebSocket 推送
- ✅ **故障确认**：连续 N 次失败才判定故障（可配置），防止网络抖动误报
- ✅ **维护窗口**：计划内停机自动暂停检测、不告警、不计入可用率
- ✅ **数据可视化**：响应时间趋势图（24h/7d/30d）、可用率统计、故障事件时间线

### 故障通知
- ✅ **6 种通知渠道**：邮件（SMTP）、Telegram、Webhook、钉钉机器人、飞书机器人、企业微信机器人
- ✅ 按监控项绑定渠道，未绑定则使用全部启用渠道
- ✅ 故障 + 恢复双通知，支持发送测试消息
- ✅ 浏览器桌面通知（可选）

### 状态页功能
- ✅ **公开状态页**：可公开访问的服务状态页面
- ✅ **密码保护**（可选）
- ✅ **30天热力图** + 最近故障事件展示 + 维护状态显示

### 用户与权限
- ✅ **三级权限**：管理员、普通用户、访客（只读）
- ✅ **数据归属**：普通用户只能管理自己创建的监控项，管理员管理全部
- ✅ **API Key**：只读 API 访问凭证，适合接入第三方面板（如 Grafana）

### 运维能力
- ✅ **Prometheus 指标**：`/metrics` 端点
- ✅ **自动备份**：每日定时备份数据库，管理后台可手动备份/下载
- ✅ **数据降采样**：原始记录默认保留 48 小时，历史数据自动聚合成小时级统计，长期运行数据库不膨胀
- ✅ **导入导出**：监控配置 JSON 导入/导出
- ✅ **安全**：安装时自动生成随机 JWT Secret、登录限流防暴力破解、Socket.io 鉴权、helm 安全头、改角色/删用户令牌立即失效

## 技术栈

### 后端
- **Node.js** v18+ - 运行时环境
- **Express.js** - Web 框架
- **better-sqlite3** - SQLite 数据库（WAL 模式）
- **Socket.io** - 实时通信
- **node-cron** - 定时任务调度
- **jsonwebtoken** - JWT 认证
- **bcryptjs** - 密码加密
- **Joi** - 数据验证
- **nodemailer** - 邮件通知
- **helmet / express-rate-limit** - 安全防护

### 前端
- **Vue 3** - 前端框架（Composition API）
- **Vite** - 构建工具
- **Tailwind CSS v4** - 原子化样式
- **shadcn/ui 设计体系** - 参照 [shadcn-ui/ui](https://github.com/shadcn-ui/ui) 的设计令牌与组件风格（Vue 实现），支持亮/暗/跟随系统主题与强调色切换
- **lucide-icons** - 图标库
- **Pinia** - 状态管理
- **Vue Router** - 路由管理
- **ECharts** - 数据可视化
- **Socket.io-client** - 实时通信
- **dayjs** - 时间处理

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
git clone https://github.com/LangfordKuo/Uptime.git
cd Uptime
docker compose up -d
```

访问 `http://localhost:8080` 完成安装。数据持久化在 `uptime-data` 卷中。

### 方式二：手动部署

环境要求：Node.js >= 18.0.0，npm >= 9.0.0

```bash
git clone https://github.com/LangfordKuo/Uptime.git
cd Uptime

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

```bash
# 启动后端服务（端口 3000）
cd backend
npm start

# 启动前端开发服务器（端口 5173）
cd frontend
npm run dev
```

访问 http://localhost:5173 开始使用。
生产部署可用宝塔等面板设置反向代理（前端 5173 / 或 `npm run build` 后托管 dist 静态文件）。

### 首次安装

1. 访问首页自动跳转到安装页面
2. 创建管理员账户
3. 安装完成后监控服务立即启动，**无需重启**（自动生成随机 JWT Secret）

## 使用指南

### 创建监控项
1. 点击"新建监控"，选择监控类型
2. 按类型填写目标（URL / host:port / 域名 / 容器名等）
3. 可配置：检测间隔、超时、故障确认次数、关键词检查、通知渠道、分组标签
4. 保存后立即开始监控

### Push 心跳监控
创建 push 类型监控后复制推送 URL，在需要监控的服务里定期请求：

```bash
# 正常心跳（cron 定时执行）
curl https://your-domain/api/push/<token>

# 主动上报故障
curl "https://your-domain/api/push/<token>?status=down&msg=备份失败"
```

超过心跳周期 1.5 倍未收到上报即判定故障。

### 故障通知
1. 进入「系统管理 → 通知渠道」创建渠道（支持发送测试消息）
2. 编辑监控项时绑定渠道（不绑定则使用全部启用渠道）

### 创建状态页
1. 进入"状态页管理"，新建状态页，可选设置访问密码
2. 选择要展示的监控项
3. 通过 `/status/{slug}` 访问

### 系统设置
- 基础设置：网站信息、主题、时区
- 通知渠道 / API Key / 备份管理

## 环境变量（后端）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 监听端口 |
| `JWT_SECRET` | 安装时自动生成 | JWT 密钥（建议不设，自动管理） |
| `CORS_ORIGIN` | http://localhost:5173 | 允许的来源，逗号分隔多个，`*` 全部 |
| `RAW_RETENTION_HOURS` | 48 | 原始检测记录保留小时数 |
| `DATA_RETENTION_DAYS` | 365 | 聚合数据保留天数 |
| `CLEANUP_INTERVAL` | `30 2 * * *` | 数据清理/聚合定时任务 |
| `BACKUP_ENABLED` | true | 是否开启每日自动备份 |
| `BACKUP_INTERVAL` | `0 4 * * *` | 自动备份时间 |
| `BACKUP_KEEP` | 7 | 备份保留份数 |
| `METRICS_ENABLED` | true | 是否开启 /metrics 端点 |

## API 文档

### 认证
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册（管理员）
- `GET /api/auth/me` - 获取当前用户信息

### 监控管理
- `GET /api/monitors` - 获取监控列表（按角色过滤）
- `POST /api/monitors` - 创建监控
- `PUT /api/monitors/:id` - 更新监控
- `DELETE /api/monitors/:id` - 删除监控
- `POST /api/monitors/:id/check` - 立即执行一次检测
- `GET /api/monitors/export/data` - 导出监控配置
- `POST /api/monitors/import` - 导入监控配置
- `GET/POST /api/monitors/:id/maintenance` - 维护窗口管理

### 通知 / 备份 / API Key（管理员）
- `GET/POST /api/notifications/channels`、`PUT/DELETE /api/notifications/channels/:id`、`POST /api/notifications/channels/:id/test`
- `GET/POST /api/backups`、`GET /api/backups/:name/download`
- `GET/POST /api/api-keys`、`DELETE /api/api-keys/:id`

### 状态页
- `GET/POST /api/status-pages/public/:slug` - 公开访问（密码页通过 POST 传 `{password}`）

### 其他
- `POST /api/push/:token` - Push 心跳上报
- `GET /metrics` - Prometheus 指标
- `GET /health` - 健康检查

API Key 通过 `X-API-Key` 请求头使用，拥有只读权限。

## 项目结构

```
Uptime/
├── backend/
│   ├── src/
│   │   ├── controllers/    # 控制器
│   │   ├── models/         # 数据模型（better-sqlite3 + 迁移机制）
│   │   ├── routes/         # 路由
│   │   ├── middleware/     # 中间件（JWT/API Key 鉴权）
│   │   ├── services/       # 业务服务（检测/通知/统计/备份）
│   │   ├── jobs/           # 调度器
│   │   ├── utils/          # 工具函数
│   │   ├── container.js    # 服务容器（支持安装后热启动）
│   │   └── app.js          # 入口文件
│   ├── test/               # 单元测试 (node --test)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── views/          # 页面视图
│   │   ├── components/     # 组件
│   │   ├── router/         # 路由配置
│   │   ├── stores/         # 状态管理
│   │   ├── api/            # API 封装
│   │   ├── utils/          # 工具函数
│   │   └── styles/         # 样式文件
│   ├── Dockerfile / nginx.conf
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 从旧版本升级

直接启动新版后端即可，启动时会自动执行数据库迁移：
- 旧 `sql.js` 数据库文件无需转换（同为 SQLite 格式）
- 自动为 monitors 表增加新字段（分组、标签、归属、故障确认、推送 Token）
- 新增通知渠道、维护窗口、API Key、小时聚合等新表
- 历史监控数据保持可用；新监控类型（push/ssl/domain/dns/docker）立即可用

## 许可证

Apache-2.0 license

# Uptime Monitor - 服务监控系统

一个类似 UptimeRobot 的服务监控系统，支持 HTTP/HTTPS、TCP 端口和 PING 监控，提供实时状态更新和可视化统计。

## 功能特性

- ✅ **多种监控类型**
  - HTTP/HTTPS 网站和 API 监控
  - TCP 端口连接检测
  - PING 网络可达性检测

- ✅ **实时监控**
  - 自定义检测间隔（最低 10 秒）
  - 实时状态推送（Socket.io）
  - 自动故障检测和记录

- ✅ **数据可视化**
  - 实时状态仪表盘
  - 响应时间趋势图
  - 可用率统计（24h/7d/30d）
  - 故障事件时间线

- ✅ **灵活配置**
  - 支持启用/禁用监控项
  - 自定义超时时间
  - HTTP 请求方法和期望状态码配置
  - 数据自动清理（可配置保留天数）

## 技术栈

### 后端
- **Node.js** - 运行时环境
- **Express.js** - Web 框架
- **SQLite3** (better-sqlite3) - 数据库
- **Socket.io** - 实时通信
- **Axios** - HTTP 请求
- **node-cron** - 定时任务调度
- **Joi** - 数据验证

### 前端
- **Vue 3** - 前端框架（Composition API）
- **Vite** - 构建工具
- **Element Plus** - UI 组件库
- **Pinia** - 状态管理
- **Vue Router** - 路由管理
- **ECharts** - 数据可视化
- **Socket.io-client** - 实时通信
- **Axios** - HTTP 请求

## 项目结构

```
Uptime/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── config/            # 配置文件
│   │   ├── controllers/       # 控制器
│   │   ├── models/            # 数据模型
│   │   ├── services/          # 业务逻辑
│   │   ├── routes/            # 路由定义
│   │   ├── jobs/              # 定时任务
│   │   └── app.js             # 应用入口
│   ├── database/              # SQLite 数据库
│   ├── package.json
│   └── .env                   # 环境变量
│
├── frontend/                  # 前端应用
│   ├── src/
│   │   ├── api/              # API 接口封装
│   │   ├── components/       # 公共组件
│   │   ├── views/            # 页面视图
│   │   ├── router/           # 路由配置
│   │   ├── stores/           # Pinia 状态管理
│   │   ├── utils/            # 工具函数
│   │   ├── App.vue
│   │   └── main.js
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装步骤

#### 1. 安装后端依赖

```bash
cd backend
npm install
```

#### 2. 安装前端依赖

```bash
cd frontend
npm install
```

### 运行项目

#### 1. 启动后端服务

```bash
cd backend
npm start
```

后端服务将运行在 `http://localhost:3000`

#### 2. 启动前端开发服务器

```bash
cd frontend
npm run dev
```

前端应用将运行在 `http://localhost:5173`

### 构建生产版本

#### 构建前端

```bash
cd frontend
npm run build
```

构建产物将输出到 `frontend/dist` 目录。

## 使用说明

### 创建监控项

1. 点击右上角 "新建监控" 按钮
2. 填写监控项信息：
   - **监控名称**：便于识别的名称
   - **监控类型**：HTTP/HTTPS、TCP 或 PING
   - **监控目标**：
     - HTTP: 完整的 URL（如 `https://example.com/api`）
     - TCP: 主机:端口（如 `localhost:3306`）
     - PING: 域名或 IP 地址（如 `8.8.8.8`）
   - **检测间隔**：监控检测的时间间隔（秒）
   - **超时时间**：请求超时时间（秒）
3. 点击 "创建监控项" 保存

### 查看监控详情

- 点击监控卡片可查看详细信息
- 包含：
  - 可用率统计（24h/7d/30d）
  - 平均响应时间
  - 响应时间趋势图
  - 最近检测结果
  - 故障事件历史

### 管理监控项

- **启用/禁用**：点击监控卡片菜单中的"启用"或"禁用"
- **编辑**：点击"编辑"修改监控配置
- **删除**：点击"删除"移除监控项

## API 接口

### 监控项管理

- `GET /api/monitors` - 获取所有监控项
- `POST /api/monitors` - 创建监控项
- `GET /api/monitors/:id` - 获取单个监控项
- `PUT /api/monitors/:id` - 更新监控项
- `DELETE /api/monitors/:id` - 删除监控项
- `POST /api/monitors/:id/toggle` - 切换启用状态

### 数据查询

- `GET /api/monitors/:id/results` - 获取检测历史
- `GET /api/monitors/:id/stats` - 获取统计数据
- `GET /api/monitors/:id/incidents` - 获取故障事件
- `GET /api/dashboard` - 获取仪表盘总览

### Socket.io 事件

- `monitor:status` - 监控状态更新
- `monitor:incident` - 故障事件通知

## 配置说明

### 后端环境变量 (.env)

```env
PORT=3000                          # 服务端口
CORS_ORIGIN=http://localhost:5173 # 允许的前端地址
DATA_RETENTION_DAYS=30             # 数据保留天数
NODE_ENV=development               # 运行环境
```

### 前端代理配置 (vite.config.js)

```javascript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

## 数据库设计

系统使用 SQLite 数据库，包含以下表：

- **monitors** - 监控项配置
- **check_results** - 检测结果记录
- **incidents** - 故障事件记录

## 开发指南

### 后端开发

```bash
cd backend
npm run dev  # 使用 --watch 模式运行
```

### 前端开发

```bash
cd frontend
npm run dev
```

前端支持热更新，修改代码后自动刷新。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 作者

Your Name
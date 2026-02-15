# Uptime Monitor - 服务监控系统
> 云服务器推荐：https://lyew.com/

一个类似 UptimeRobot 的服务监控系统，支持 HTTP/HTTPS、TCP 端口和 PING 监控，提供实时状态更新、可视化统计和公开状态页展示。
<img width="2538" height="1285" alt="ScreenshotUptime" src="https://github.com/user-attachments/assets/5ba4a9ff-c255-40a4-a263-9e4cda63273d" />


## 功能特性

### 监控功能
- ✅ **多种监控类型**：HTTP/HTTPS、TCP 端口、PING 网络检测
- ✅ **实时监控**：自定义检测间隔（最低 10 秒），实时状态推送
- ✅ **故障检测**：自动故障检测、记录和通知
- ✅ **数据可视化**：响应时间趋势图、可用率统计（24h/7d/30d）、故障事件时间线

### 状态页功能
- ✅ **公开状态页**：创建可公开访问的服务状态页面
- ✅ **自定义配置**：支持自定义名称、描述、Logo
- ✅ **30天热力图**：展示服务历史可用率
- ✅ **实时更新**：自动同步最新监控状态

### 用户与权限
- ✅ **三级权限**：管理员、普通用户、访客
- ✅ **用户管理**：管理员可创建、编辑、删除用户
- ✅ **权限控制**：基于角色的访问控制（RBAC）

## 技术栈

### 后端
- **Node.js** v18+ - 运行时环境
- **Express.js** - Web 框架
- **sql.js** - SQLite 数据库
- **Socket.io** - 实时通信
- **node-cron** - 定时任务调度
- **jsonwebtoken** - JWT 认证
- **bcryptjs** - 密码加密
- **Joi** - 数据验证

### 前端
- **Vue 3** - 前端框架（Composition API）
- **Vite** - 构建工具
- **Element Plus** - UI 组件库
- **Pinia** - 状态管理
- **Vue Router** - 路由管理
- **ECharts** - 数据可视化
- **Socket.io-client** - 实时通信
- **dayjs** - 时间处理

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装步骤

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 运行项目

```bash
# 启动后端服务（端口 3000）
cd backend
npm start

# 启动前端开发服务器（端口 5173）
cd frontend
npm run dev
```

访问 http://localhost:5173 开始使用

### 首次安装

1. 访问 http://localhost:5173 自动跳转到安装页面
2. 创建管理员账户
3. 登录后开始使用

## 使用指南

### 创建监控项
1. 点击左侧"新建监控"
2. 填写监控信息（名称、类型、目标、检测间隔）
3. 保存后自动开始监控

### 创建状态页
1. 进入"状态页管理"
2. 点击"新建状态页"
3. 配置名称、Slug、选择要展示的监控项
4. 通过 `/status/{slug}` 访问公开状态页

### 系统设置
1. 进入"系统管理"
2. 配置网站基本信息
3. 切换主题模式或强调色

## API 文档

### 认证
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册（管理员）
- `GET /api/auth/me` - 获取当前用户信息

### 监控管理
- `GET /api/monitors` - 获取监控列表
- `POST /api/monitors` - 创建监控
- `GET /api/monitors/:id` - 获取监控详情
- `PUT /api/monitors/:id` - 更新监控
- `DELETE /api/monitors/:id` - 删除监控

### 状态页
- `GET /api/status-pages` - 获取状态页列表
- `POST /api/status-pages` - 创建状态页
- `GET /api/status-pages/public/:slug` - 公开访问状态页

### 用户管理
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

## 项目结构

```
Uptime/
├── backend/
│   ├── src/
│   │   ├── controllers/    # 控制器
│   │   ├── models/         # 数据模型
│   │   ├── routes/         # 路由
│   │   ├── middleware/     # 中间件
│   │   ├── services/       # 业务服务
│   │   └── app.js          # 入口文件
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── views/          # 页面视图
│   │   ├── router/         # 路由配置
│   │   ├── stores/         # 状态管理
│   │   ├── api/            # API 封装
│   │   ├── utils/          # 工具函数
│   │   └── styles/         # 样式文件
│   └── package.json
└── README.md
```

## 许可证

Apache-2.0 license

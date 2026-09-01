import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import config from './config/config.js';
import { initializeDatabase, closeDatabase, isInstalled } from './models/database.js';
import { setIo, initServices, stopServices, isServicesInitialized } from './container.js';
import { loadJwtSecret, socketAuth } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import installRoutes from './routes/install.js';
import statusPageRoutes from './routes/statusPages.js';
import systemSettingRoutes from './routes/systemSettings.js';
import pushRoutes from './routes/push.js';
import metricsRoutes from './routes/metrics.js';
import monitorRoutes from './routes/monitors.js';
import dashboardRoutes from './routes/dashboard.js';
import createMiscRoutes from './routes/misc.js';

import MaintenanceModel from './models/Maintenance.js';
import ApiKeyModel from './models/ApiKey.js';

// 加载环境变量
dotenv.config();

function parseOrigins(origin) {
  if (!origin || origin === '*') return true; // cors 的 true 表示反射请求来源
  return origin.split(',').map(s => s.trim()).filter(Boolean);
}

// 启动函数
async function startServer() {
  // 初始化数据库（未安装时也会创建空的数据库文件供安装流程写入）
  initializeDatabase();

  const app = express();
  const httpServer = createServer(app);

  app.set('trust proxy', 1);

  // 安全响应头（纯 API 服务，关闭 CSP 以免干扰前端页面）
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  // CORS：支持逗号分隔多来源
  const allowedOrigins = parseOrigins(config.corsOrigin);
  app.use(cors({
    origin: (origin, callback) => {
      if (allowedOrigins === true || allowedOrigins.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    }
  }));

  // Socket.io：客户端需携带有效 token 才能连接
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins === true ? true : allowedOrigins,
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = token ? socketAuth(token) : null;
    if (!user) {
      return next(new Error('Unauthorized'));
    }
    socket.data.user = { id: user.id, username: user.username, role: user.role };
    next();
  });

  setIo(io);

  // 中间件
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 全局 API 限流（宽松；心跳接口豁免，机器上报不能被限流）
  const globalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/api/push') || req.path.startsWith('/api/push/')
  });
  app.use('/api', globalLimiter);

  // 登录接口严格限流，防暴力破解
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: '尝试次数过多，请 15 分钟后再试' }
  });
  app.use('/api/auth/login', loginLimiter);

  // 错误日志中间件（仅记录错误请求）
  app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
      if (res.statusCode >= 400) {
        console.error(`[${new Date().toISOString()}] ERROR ${res.statusCode} ${req.method} ${req.url}`);
      }
      return originalSend.call(this, body);
    };
    next();
  });

  // 已安装则启动监控服务、调度器与备份
  if (isInstalled()) {
    loadJwtSecret();
    initServices();
  }

  // 配置路由
  app.use('/api/install', installRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/monitors', monitorRoutes);
  app.use('/api/status-pages', statusPageRoutes);
  app.use('/api/settings', systemSettingRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api', createMiscRoutes(MaintenanceModel, ApiKeyModel));
  app.use('/', metricsRoutes);

  // 健康检查端点
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      installed: isInstalled(),
      services: isServicesInitialized(),
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Socket.io 连接处理
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id} (user: ${socket.data.user?.username})`);
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // 错误处理中间件（生产环境不泄露内部错误细节）
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  // 404 处理
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });

  // 启动服务器
  const PORT = config.port;
  httpServer.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });

  // 优雅关闭
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);
    stopServices();
    httpServer.close(() => {
      closeDatabase();
      process.exit(0);
    });
    // 兜底：5 秒后强制退出
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return app;
}

// 启动服务器
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

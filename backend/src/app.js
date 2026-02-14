import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/config.js';
import { initializeDatabase } from './models/database.js';
import MonitorService from './services/monitorService.js';
import StatisticsService from './services/statisticsService.js';
import SchedulerService from './jobs/scheduler.js';
import MonitorController from './controllers/monitorController.js';
import createMonitorRoutes from './routes/monitors.js';
import createDashboardRoutes from './routes/dashboard.js';
import authRoutes from './routes/auth.js';
import installRoutes from './routes/install.js';
import statusPageRoutes from './routes/statusPages.js';
import systemSettingRoutes from './routes/systemSettings.js';
import { authenticate, authorize, optionalAuth } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../database/uptime.db');

// 加载环境变量
dotenv.config();

// 启动函数
async function startServer() {
  // 创建 Express 应用
  const app = express();
  const httpServer = createServer(app);

  // 配置 Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST']
    }
  });

  // 中间件
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 错误日志中间件（仅记录错误请求）
  app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function(body) {
      // 记录 4xx 和 5xx 错误
      if (res.statusCode >= 400) {
        console.error(`[${new Date().toISOString()}] ERROR ${res.statusCode} ${req.method} ${req.url}`);
      }
      return originalSend.call(this, body);
    };
    next();
  });

  // 初始化数据库
  await initializeDatabase();

  // 检查数据库是否已安装
  const isInstalled = fs.existsSync(dbPath);
  
  let monitorService, schedulerService, monitorController;
  
  if (isInstalled) {
    // 数据库已安装，初始化服务
    monitorService = new MonitorService(io);
    schedulerService = new SchedulerService(monitorService);
    monitorController = new MonitorController(schedulerService);
  } else {
    // 创建空的控制器用于路由注册
    const notInstalledResponse = (req, res) => {
      res.status(503).json({ success: false, message: 'System not installed' });
    };
    
    monitorController = {
      getAllMonitors: notInstalledResponse,
      getMonitorById: notInstalledResponse,
      createMonitor: notInstalledResponse,
      updateMonitor: notInstalledResponse,
      deleteMonitor: notInstalledResponse,
      toggleMonitor: notInstalledResponse,
      getCheckResults: notInstalledResponse,
      getStats: notInstalledResponse,
      getIncidents: notInstalledResponse,
      getDashboard: notInstalledResponse
    };
  }

  // 配置路由
  // 安装路由（公开）
  app.use('/api/install', installRoutes);
  
  // 认证路由（公开）
  app.use('/api/auth', authRoutes);
  
  // 仪表盘路由（所有人可查看，但需要登录才能操作）
  app.use('/api/dashboard', optionalAuth, createDashboardRoutes(monitorController));
  
  // 监控项路由（需要登录，管理员和普通用户可操作）
  app.use('/api/monitors', authenticate, authorize('admin', 'user'), createMonitorRoutes(monitorController));

  // 状态页路由
  app.use('/api/status-pages', statusPageRoutes);

  // 系统设置路由
  app.use('/api/settings', systemSettingRoutes);

  // 健康检查端点
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Socket.io 连接处理
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // 错误处理中间件
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

  // 启动调度器（仅在已安装时）
  if (isInstalled && schedulerService) {
    schedulerService.initializeSchedules();

    // 设置定期数据清理任务
    cron.schedule(config.cleanupInterval, () => {
      StatisticsService.cleanupOldData(config.dataRetentionDays);
    });
  }

  // 启动服务器
  const PORT = config.port;
  httpServer.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });

  // 优雅关闭
  process.on('SIGTERM', () => {
    schedulerService?.stopAll();
    httpServer.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    schedulerService?.stopAll();
    httpServer.close(() => {
      process.exit(0);
    });
  });

  return app;
}

// 启动服务器
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


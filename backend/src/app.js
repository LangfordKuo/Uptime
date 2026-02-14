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

  // 日志中间件
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // 初始化数据库
  console.log('Initializing database...');
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
    console.log('Database not installed. Monitoring services will not be started.');
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
    console.log('Starting scheduler...');
    schedulerService.initializeSchedules();

    // 设置定期数据清理任务
    cron.schedule(config.cleanupInterval, () => {
      console.log('Running scheduled data cleanup...');
      StatisticsService.cleanupOldData(config.dataRetentionDays);
    });
  } else {
    console.log('Scheduler not started (system not installed)');
  }

  // 启动服务器
  const PORT = config.port;
  httpServer.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`Uptime Monitor Server Started`);
    console.log(`=================================`);
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`=================================`);
  });

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    schedulerService.stopAll();
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    schedulerService.stopAll();
    httpServer.close(() => {
      console.log('Server closed');
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


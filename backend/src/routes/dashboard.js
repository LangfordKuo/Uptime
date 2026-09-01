import express from 'express';
import monitorController from '../controllers/monitorController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// 仪表盘：登录后可查看（viewer / API Key 也可读），数据按角色过滤
router.get('/', optionalAuth, monitorController.getDashboard);

export default router;

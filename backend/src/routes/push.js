import express from 'express';
import rateLimit from 'express-rate-limit';
import MonitorModel from '../models/Monitor.js';
import { getServices } from '../container.js';

// Push 心跳接口：被监控服务主动上报存活状态（公开访问，token 即凭证）
const pushLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

function handlePush(req, res) {
  const monitor = MonitorModel.getByPushToken(req.params.token);

  if (!monitor) {
    return res.status(404).json({ success: false, message: 'Invalid push token' });
  }
  if (!monitor.enabled) {
    return res.json({ success: true, message: 'Monitor is paused, heartbeat ignored' });
  }

  const monitorService = getServices().monitorService;
  if (!monitorService) {
    return res.status(503).json({ success: false, message: 'Service not initialized' });
  }

  const { status, msg } = req.query;
  const result = monitorService.recordPush(monitor, {
    status: status === 'down' ? 'down' : 'up',
    message: msg ? String(msg).slice(0, 500) : null
  });

  res.json({
    success: true,
    data: { status: result.status },
    message: 'Heartbeat received'
  });
}

const router = express.Router();
router.post('/:token', pushLimiter, handlePush);
// GET 也支持，方便 cron + curl 场景
router.get('/:token', pushLimiter, handlePush);

export default router;

import express from 'express';
import path from 'path';
import Joi from 'joi';
import notificationController from '../controllers/notificationController.js';
import MonitorModel from '../models/Monitor.js';
import { getServices } from '../container.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

const maintenanceSchema = Joi.object({
  name: Joi.string().allow('').max(100),
  start_at: Joi.string().required(),
  end_at: Joi.string().required()
});

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

export default function createMiscRoutes(maintenanceModel, apiKeyModel) {
  const admin = [authenticate, authorize('admin')];

  // ===== 通知渠道 =====
  router.get('/notifications/channels', admin, notificationController.getAll);
  router.post('/notifications/channels', admin, notificationController.create);
  router.put('/notifications/channels/:id', admin, notificationController.update);
  router.delete('/notifications/channels/:id', admin, notificationController.delete);
  router.post('/notifications/channels/:id/test', admin, notificationController.test);

  // ===== 维护窗口 =====
  router.get('/monitors/:id/maintenance', authenticate, (req, res) => {
    const windows = maintenanceModel.getAll(req.params.id);
    res.json({ success: true, data: windows });
  });

  router.post('/monitors/:id/maintenance', authenticate, authorize('admin', 'user'), (req, res) => {
    const { error, value } = maintenanceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    // 归属校验
    const monitor = MonitorModel.getById(req.params.id);
    if (!monitor) {
      return res.status(404).json({ success: false, message: '监控项不存在' });
    }
    if (req.user.role !== 'admin' && monitor.user_id !== null && monitor.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: '无权操作此监控项' });
    }
    const start = new Date(value.start_at);
    const end = new Date(value.end_at);
    if (isNaN(start) || isNaN(end) || end <= start) {
      return res.status(400).json({ success: false, message: '时间范围无效' });
    }
    const win = maintenanceModel.create(req.params.id, value);
    res.status(201).json({ success: true, data: win, message: '维护窗口已创建' });
  });

  router.delete('/maintenance/:windowId', authenticate, authorize('admin', 'user'), (req, res) => {
    const success = maintenanceModel.delete(req.params.windowId);
    if (!success) return fail(res, 404, '维护窗口不存在');
    res.json({ success: true, message: '维护窗口已删除' });
  });

  // ===== API Keys =====
  router.get('/api-keys', admin, (req, res) => {
    res.json({ success: true, data: apiKeyModel.getAll() });
  });

  router.post('/api-keys', admin, (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 100) {
      return res.status(400).json({ success: false, message: '名称不能为空' });
    }
    const apiKey = apiKeyModel.create(name);
    res.status(201).json({
      success: true,
      data: apiKey,
      message: 'API Key 已创建（仅此一次展示完整 Key，请妥善保存）'
    });
  });

  router.delete('/api-keys/:id', admin, (req, res) => {
    const success = apiKeyModel.delete(req.params.id);
    if (!success) return fail(res, 404, 'API Key 不存在');
    res.json({ success: true, message: 'API Key 已删除' });
  });

  // ===== 数据库备份 =====
  router.get('/backups', admin, (req, res) => {
    const backupService = getServices().backupService;
    res.json({ success: true, data: backupService ? backupService.listBackups() : [] });
  });

  router.post('/backups', admin, async (req, res) => {
    const backupService = getServices().backupService;
    if (!backupService) return fail(res, 503, '服务未初始化');
    try {
      const filename = await backupService.createBackup('manual');
      res.json({ success: true, data: { filename }, message: '备份已创建' });
    } catch (error) {
      console.error('Backup failed:', error);
      fail(res, 500, '备份失败');
    }
  });

  router.get('/backups/:name/download', admin, (req, res) => {
    const backupService = getServices().backupService;
    if (!backupService) return fail(res, 503, '服务未初始化');
    const stream = backupService.getBackupStream(req.params.name);
    if (!stream) return fail(res, 404, '备份文件不存在');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(path.basename(req.params.name))}"`
    );
    stream.pipe(res);
  });

  return router;
}

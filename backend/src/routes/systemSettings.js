import { Router } from 'express';
import systemSettingController from '../controllers/systemSettingController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// 获取网站设置（公开）
router.get('/site', systemSettingController.getSiteSettings);

// 以下接口需要管理员权限
router.get('/', authenticate, authorize('admin'), systemSettingController.getAllSettings);
router.post('/site', authenticate, authorize('admin'), systemSettingController.saveSiteSettings);
router.get('/:key', authenticate, authorize('admin'), systemSettingController.getSetting);
router.post('/:key', authenticate, authorize('admin'), systemSettingController.setSetting);

export default router;

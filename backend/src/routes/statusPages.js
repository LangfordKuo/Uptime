import express from 'express';
import statusPageController from '../controllers/statusPageController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// 公开路由 - 访客可以访问公开的状态页
router.get('/public/:slug', statusPageController.getPublicStatusPage);

// 需要认证的路由 - 管理员可以管理状态页
router.get('/', authenticate, authorize('admin'), statusPageController.getAllStatusPages);
router.get('/:id', authenticate, authorize('admin'), statusPageController.getStatusPageById);
router.post('/', authenticate, authorize('admin'), statusPageController.createStatusPage);
router.put('/:id', authenticate, authorize('admin'), statusPageController.updateStatusPage);
router.delete('/:id', authenticate, authorize('admin'), statusPageController.deleteStatusPage);

export default router;

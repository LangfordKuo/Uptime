import express from 'express';
import authController from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// 公开路由
router.post('/login', authController.login);

// 需要认证的路由
router.get('/me', authenticate, authController.getCurrentUser);

// 仅管理员可访问
router.post('/register', authenticate, authorize('admin'), authController.register);
router.get('/users', authenticate, authorize('admin'), authController.getAllUsers);
router.delete('/users/:id', authenticate, authorize('admin'), authController.deleteUser);

// 修改用户信息（管理员可修改任何人，普通用户只能修改自己）
router.put('/users/:id/username', authenticate, authController.updateUsername);
router.put('/users/:id/password', authenticate, authController.updatePassword);

export default router;

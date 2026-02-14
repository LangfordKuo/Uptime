import express from 'express';
import installController from '../controllers/installController.js';

const router = express.Router();

// 检查是否已安装
router.get('/check', installController.checkInstalled);

// 执行安装
router.post('/setup', installController.install);

export default router;

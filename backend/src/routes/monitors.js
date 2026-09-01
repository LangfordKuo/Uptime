import express from 'express';
import monitorController from '../controllers/monitorController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// 所有角色可读（含 viewer / API Key），写入操作限 admin 和 user
router.get('/', authenticate, authorize('admin', 'user', 'viewer'), monitorController.getAllMonitors);
router.get('/:id', authenticate, authorize('admin', 'user', 'viewer'), monitorController.getMonitorById);
router.get('/:id/results', authenticate, authorize('admin', 'user', 'viewer'), monitorController.getCheckResults);
router.get('/:id/stats', authenticate, authorize('admin', 'user', 'viewer'), monitorController.getStats);
router.get('/:id/incidents', authenticate, authorize('admin', 'user', 'viewer'), monitorController.getIncidents);

// 写操作
router.post('/', authenticate, authorize('admin', 'user'), monitorController.createMonitor);
router.put('/:id', authenticate, authorize('admin', 'user'), monitorController.updateMonitor);
router.delete('/:id', authenticate, authorize('admin', 'user'), monitorController.deleteMonitor);
router.post('/:id/toggle', authenticate, authorize('admin', 'user'), monitorController.toggleMonitor);
router.post('/:id/check', authenticate, authorize('admin', 'user'), monitorController.checkNow);

// 导入导出
router.get('/export/data', authenticate, authorize('admin', 'user'), monitorController.exportMonitors);
router.post('/import', authenticate, authorize('admin', 'user'), monitorController.importMonitors);

export default router;

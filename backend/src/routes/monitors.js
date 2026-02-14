import express from 'express';

function createMonitorRoutes(monitorController) {
  const router = express.Router();

  // 监控项管理路由
  router.get('/', monitorController.getAllMonitors);
  router.post('/', monitorController.createMonitor);
  router.get('/:id', monitorController.getMonitorById);
  router.put('/:id', monitorController.updateMonitor);
  router.delete('/:id', monitorController.deleteMonitor);
  router.post('/:id/toggle', monitorController.toggleMonitor);

  // 检测结果与统计路由
  router.get('/:id/results', monitorController.getCheckResults);
  router.get('/:id/stats', monitorController.getStats);
  router.get('/:id/incidents', monitorController.getIncidents);

  return router;
}

export default createMonitorRoutes;

import express from 'express';

function createDashboardRoutes(monitorController) {
  const router = express.Router();

  router.get('/', monitorController.getDashboard);

  return router;
}

export default createDashboardRoutes;

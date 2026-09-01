import MonitorService from './services/monitorService.js';
import SchedulerService from './jobs/scheduler.js';
import StatisticsService from './services/statisticsService.js';
import BackupService from './services/backupService.js';

// 服务容器：集中管理需要数据库就绪后才能初始化的服务。
// 安装完成后可以调用 initServices() 热启动，无需重启进程。
const state = {
  io: null,
  monitorService: null,
  schedulerService: null,
  backupService: null,
  initialized: false
};

export function setIo(io) {
  state.io = io;
}

export function getServices() {
  return state;
}

export function isServicesInitialized() {
  return state.initialized;
}

export function initServices() {
  if (state.initialized) return state;

  state.monitorService = new MonitorService(state.io);
  state.schedulerService = new SchedulerService(state.monitorService);
  state.backupService = new BackupService();
  state.initialized = true;

  state.schedulerService.initializeSchedules();
  state.schedulerService.startPushSweeper();
  state.backupService.initialize();

  // 每天定时清理/聚合历史数据
  state.schedulerService.addGlobalCron(
    'cleanup',
    process.env.CLEANUP_INTERVAL || '30 2 * * *',
    () => StatisticsService.runDailyMaintenance()
  );

  console.log('Services initialized (monitor scheduler, push sweeper, backups)');
  return state;
}

export function stopServices() {
  if (state.schedulerService) state.schedulerService.stopAll();
  if (state.backupService) state.backupService.stop();
  state.initialized = false;
}

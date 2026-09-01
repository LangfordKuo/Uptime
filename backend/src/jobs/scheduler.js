import cron from 'node-cron';
import MonitorModel from '../models/Monitor.js';
import MaintenanceModel from '../models/Maintenance.js';

class SchedulerService {
  constructor(monitorService) {
    this.monitorService = monitorService;
    this.tasks = new Map();      // monitorId -> task
    this.running = new Set();    // 正在执行检测的 monitorId，防止任务重叠堆积
    this.globalCrons = new Map(); // name -> cron task（清理、备份等全局任务）
    this.pushSweeper = null;
  }

  // 为监控项创建定时任务
  scheduleMonitor(monitor) {
    if (monitor.type === 'push') {
      // Push 类型是被动接收心跳，由 startPushSweeper 统一巡检，不需要单独调度
      return;
    }

    if (this.tasks.has(monitor.id)) {
      this.unscheduleMonitor(monitor.id);
    }

    const intervalMs = Math.max(10, monitor.interval) * 1000;

    // 防重叠的执行体：上一轮检测未结束时跳过本轮，避免任务堆积
    const tick = async () => {
      if (this.running.has(monitor.id)) {
        console.warn(`Monitor #${monitor.id} check still running, skipping this tick`);
        return;
      }
      this.running.add(monitor.id);
      try {
        await this.executeMonitorCheck(monitor.id);
      } finally {
        this.running.delete(monitor.id);
      }
    };

    // 错峰：首次检测在 0~3 秒内随机延迟，避免大量监控同一瞬间齐发
    const firstDelay = Math.floor(Math.random() * Math.min(3000, intervalMs / 2));
    const firstTimer = setTimeout(() => {
      tick(); // 立即执行第一次检测，不用干等一个周期
      const intervalId = setInterval(tick, intervalMs);
      task.intervalId = intervalId;
    }, firstDelay);

    const task = {
      stop: () => {
        clearTimeout(firstTimer);
        if (task.intervalId) clearInterval(task.intervalId);
      },
      intervalId: null
    };

    this.tasks.set(monitor.id, task);
    console.log(`Scheduled monitor #${monitor.id} (${monitor.name}) with interval ${monitor.interval}s`);
  }

  // 停止监控项的定时任务
  unscheduleMonitor(monitorId) {
    const task = this.tasks.get(monitorId);
    if (task) {
      task.stop();
      this.tasks.delete(monitorId);
      console.log(`Unscheduled monitor #${monitorId}`);
    }
  }

  // 执行单个监控检测
  async executeMonitorCheck(monitorId, { force = false } = {}) {
    try {
      const monitor = MonitorModel.getById(monitorId);

      if (!monitor) {
        console.warn(`Monitor #${monitorId} not found, unscheduling...`);
        this.unscheduleMonitor(monitorId);
        return null;
      }

      if (!monitor.enabled && !force) {
        return null;
      }

      // 维护窗口内暂停检测：不产生数据、不触发告警，也不计入可用率
      if (!force && MaintenanceModel.isInMaintenance(monitorId)) {
        return null;
      }

      return await this.monitorService.executeCheck(monitor);
    } catch (error) {
      console.error(`Error executing check for monitor #${monitorId}:`, error);
      return null;
    }
  }

  // Push 监控巡检：定期检查心跳是否超时
  startPushSweeper() {
    if (this.pushSweeper) return;
    this.pushSweeper = setInterval(() => {
      this.sweepPushMonitors().catch(err =>
        console.error('Push sweeper error:', err)
      );
    }, 30 * 1000);
    console.log('Push sweeper started (every 30s)');
  }

  async sweepPushMonitors() {
    const pushMonitors = MonitorModel.getByType('push').filter(m => m.enabled);
    for (const monitor of pushMonitors) {
      try {
        if (this.running.has(monitor.id)) continue;
        this.running.add(monitor.id);
        try {
          await this.monitorService.sweepPushMonitor(monitor);
        } finally {
          this.running.delete(monitor.id);
        }
      } catch (error) {
        console.error(`Error sweeping push monitor #${monitor.id}:`, error);
      }
    }
  }

  // 注册全局定时任务（清理、备份等）
  addGlobalCron(name, expression, fn) {
    this.removeGlobalCron(name);
    const task = cron.schedule(expression, fn);
    this.globalCrons.set(name, task);
  }

  removeGlobalCron(name) {
    const task = this.globalCrons.get(name);
    if (task) {
      task.stop();
      this.globalCrons.delete(name);
    }
  }

  // 初始化所有启用的监控项调度
  initializeSchedules() {
    const enabledMonitors = MonitorModel.getEnabled();
    console.log(`Initializing ${enabledMonitors.length} enabled monitors...`);

    for (const monitor of enabledMonitors) {
      this.scheduleMonitor(monitor);
    }

    console.log('All monitors scheduled successfully');
  }

  // 停止所有调度任务
  stopAll() {
    console.log(`Stopping ${this.tasks.size} scheduled tasks...`);

    for (const [, task] of this.tasks.entries()) {
      task.stop();
    }
    this.tasks.clear();

    for (const [name] of this.globalCrons.entries()) {
      this.removeGlobalCron(name);
    }

    if (this.pushSweeper) {
      clearInterval(this.pushSweeper);
      this.pushSweeper = null;
    }

    console.log('All tasks stopped');
  }

  // 重新加载所有调度
  reloadSchedules() {
    this.stopAll();
    this.startPushSweeper();
    this.initializeSchedules();
  }

  // 获取当前调度状态
  getScheduleStatus() {
    const status = [];

    for (const [monitorId] of this.tasks.entries()) {
      const monitor = MonitorModel.getById(monitorId);
      status.push({
        monitorId,
        monitorName: monitor?.name,
        scheduled: true
      });
    }

    return status;
  }
}

export default SchedulerService;

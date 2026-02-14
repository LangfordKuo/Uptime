import cron from 'node-cron';
import MonitorModel from '../models/Monitor.js';

class SchedulerService {
  constructor(monitorService) {
    this.monitorService = monitorService;
    this.tasks = new Map(); // monitorId -> cron task
  }

  // 为监控项创建定时任务
  scheduleMonitor(monitor) {
    // 如果已存在任务，先停止
    if (this.tasks.has(monitor.id)) {
      this.unscheduleMonitor(monitor.id);
    }

    // node-cron 不支持秒级间隔，需要根据interval计算cron表达式
    // 如果间隔小于60秒，使用秒级调度
    let cronExpression;
    let task;

    if (monitor.interval < 60) {
      // 每N秒执行一次（使用setInterval模拟）
      const intervalMs = monitor.interval * 1000;
      const intervalId = setInterval(async () => {
        await this.executeMonitorCheck(monitor.id);
      }, intervalMs);

      task = {
        stop: () => clearInterval(intervalId),
        isInterval: true
      };
    } else {
      // 使用 cron 表达式（分钟级）
      const minutes = Math.floor(monitor.interval / 60);
      cronExpression = `*/${minutes} * * * *`;
      
      const cronTask = cron.schedule(cronExpression, async () => {
        await this.executeMonitorCheck(monitor.id);
      });

      task = {
        stop: () => cronTask.stop(),
        isInterval: false,
        cronTask
      };
    }

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
  async executeMonitorCheck(monitorId) {
    try {
      const monitor = MonitorModel.getById(monitorId);
      
      if (!monitor) {
        console.warn(`Monitor #${monitorId} not found, unscheduling...`);
        this.unscheduleMonitor(monitorId);
        return;
      }

      if (!monitor.enabled) {
        console.log(`Monitor #${monitorId} is disabled, skipping check`);
        return;
      }

      await this.monitorService.executeCheck(monitor);
    } catch (error) {
      console.error(`Error executing check for monitor #${monitorId}:`, error);
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
    
    for (const [monitorId, task] of this.tasks.entries()) {
      task.stop();
    }
    
    this.tasks.clear();
    console.log('All tasks stopped');
  }

  // 重新加载所有调度
  reloadSchedules() {
    this.stopAll();
    this.initializeSchedules();
  }

  // 获取当前调度状态
  getScheduleStatus() {
    const status = [];
    
    for (const [monitorId, task] of this.tasks.entries()) {
      const monitor = MonitorModel.getById(monitorId);
      status.push({
        monitorId,
        monitorName: monitor?.name,
        scheduled: true,
        type: task.isInterval ? 'interval' : 'cron'
      });
    }
    
    return status;
  }
}

export default SchedulerService;

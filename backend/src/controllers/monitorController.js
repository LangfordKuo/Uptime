import Joi from 'joi';
import MonitorModel from '../models/Monitor.js';
import MaintenanceModel from '../models/Maintenance.js';
import StatisticsService from '../services/statisticsService.js';
import { getServices } from '../container.js';
import { sanitizeIntervalTimeout } from '../utils/checkUtils.js';

const MONITOR_TYPES = ['http', 'tcp', 'ping', 'push', 'ssl', 'domain', 'dns', 'docker'];

// 验证规则
const monitorSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  type: Joi.string().required().valid(...MONITOR_TYPES),
  target: Joi.string().required().min(1).max(500),
  interval: Joi.number().integer().min(10).max(86400).default(300),
  timeout: Joi.number().integer().min(1).max(300).default(30),
  enabled: Joi.number().integer().valid(0, 1).default(1),
  config: Joi.object().optional(),
  description: Joi.string().allow('', null).max(500),
  group_name: Joi.string().allow('', null).max(100),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  max_retries: Joi.number().integer().min(1).max(10).default(1),
  channel_ids: Joi.array().items(Joi.number().integer()).optional()
});

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

class MonitorController {
  constructor() {}

  // 延迟获取调度器（安装完成前可能尚未初始化）
  get scheduler() {
    return getServices().schedulerService;
  }

  get monitorService() {
    return getServices().monitorService;
  }

  // 归属校验：admin 全部可操作；user 只能操作自己的；viewer 只读（写操作在路由层已被拦）
  canAccess(monitor, user, { write = false } = {}) {
    if (!monitor) return false;
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'viewer') return !write;
    // user 角色：自己的或未设置归属的（历史数据）
    return monitor.user_id === null || monitor.user_id === user.id;
  }

  // 附加前端需要的派生字段
  decorate(monitor) {
    let extra = null;
    try {
      extra = monitor.latest_extra ? JSON.parse(monitor.latest_extra) : null;
    } catch { /* ignore */ }

    return {
      ...monitor,
      config: monitor.config ? JSON.parse(monitor.config) : null,
      tags: monitor.tags ? JSON.parse(monitor.tags) : [],
      channel_ids: monitor.channel_ids
        ? monitor.channel_ids.split(',').map(Number)
        : [],
      latestStatus: monitor.latest_status || 'unknown',
      latestResponseTime: monitor.latest_response_time ?? null,
      latestCheck: monitor.latest_check ?? null,
      latestExtra: extra,
      inMaintenance: MaintenanceModel.isInMaintenance(monitor.id),
      push_token: monitor.type === 'push' ? monitor.push_token : undefined
    };
  }

  // 获取所有监控项（按角色过滤）
  getAllMonitors = async (req, res) => {
    try {
      const monitors = MonitorModel.getAllForUser(req.user).map(m => this.decorate(m));

      // 批量附加 24h 可用率（单条 GROUP BY 查询）
      const uptimeMap = StatisticsService.getUptime24hMap();
      for (const monitor of monitors) {
        monitor.uptime24h = uptimeMap[monitor.id] ?? null;
      }

      res.json({ success: true, data: monitors });
    } catch (error) {
      console.error('Error getting monitors:', error);
      fail(res, 500, 'Failed to get monitors');
    }
  };

  // 获取单个监控项
  getMonitorById = async (req, res) => {
    try {
      const monitor = MonitorModel.getByIdWithLatest(req.params.id);

      if (!monitor || !this.canAccess(monitor, req.user)) {
        return fail(res, 404, 'Monitor not found');
      }

      const data = this.decorate(monitor);
      data.uptime24h = StatisticsService.getUptime24hMap()[monitor.id] ?? null;

      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting monitor:', error);
      fail(res, 500, 'Failed to get monitor');
    }
  };

  // 创建监控项
  createMonitor = async (req, res) => {
    try {
      const { error, value } = monitorSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map(d => d.message)
        });
      }

      // timeout 不能 >= interval，自动修正
      const { interval, timeout } = sanitizeIntervalTimeout(value.interval, value.timeout);
      value.interval = interval;
      value.timeout = timeout;

      // push 类型不需要轮询间隔，interval 仅作占位
      if (value.type === 'push') {
        value.target = value.target || 'push';
      }

      const monitor = MonitorModel.create({ ...value, user_id: req.user.id });

      if (monitor.enabled && this.scheduler) {
        this.scheduler.scheduleMonitor(monitor);
      }

      res.status(201).json({
        success: true,
        data: this.decorate(monitor),
        message: 'Monitor created successfully'
      });
    } catch (error) {
      console.error('Error creating monitor:', error);
      fail(res, 500, 'Failed to create monitor');
    }
  };

  // 更新监控项
  updateMonitor = async (req, res) => {
    try {
      const existing = MonitorModel.getById(req.params.id);
      if (!existing || !this.canAccess(existing, req.user, { write: true })) {
        return fail(res, 404, 'Monitor not found');
      }

      const { error, value } = monitorSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map(d => d.message)
        });
      }

      const { interval, timeout } = sanitizeIntervalTimeout(value.interval, value.timeout);
      value.interval = interval;
      value.timeout = timeout;
      if (value.type === 'push') {
        value.target = value.target || 'push';
      }

      const monitor = MonitorModel.update(existing.id, value);

      // 更新调度器
      if (this.scheduler) {
        this.scheduler.unscheduleMonitor(existing.id);
        if (monitor.enabled) {
          this.scheduler.scheduleMonitor(monitor);
        }
      }

      res.json({
        success: true,
        data: this.decorate(monitor),
        message: 'Monitor updated successfully'
      });
    } catch (error) {
      console.error('Error updating monitor:', error);
      fail(res, 500, 'Failed to update monitor');
    }
  };

  // 切换启用/禁用
  toggleMonitor = async (req, res) => {
    try {
      const existing = MonitorModel.getById(req.params.id);
      if (!existing || !this.canAccess(existing, req.user, { write: true })) {
        return fail(res, 404, 'Monitor not found');
      }

      const monitor = MonitorModel.toggle(existing.id);

      if (this.scheduler) {
        this.scheduler.unscheduleMonitor(existing.id);
        if (monitor.enabled) {
          this.scheduler.scheduleMonitor(monitor);
        }
      }

      res.json({
        success: true,
        data: this.decorate(monitor),
        message: `Monitor ${monitor.enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      console.error('Error toggling monitor:', error);
      fail(res, 500, 'Failed to toggle monitor');
    }
  };

  // 立即执行一次检测
  checkNow = async (req, res) => {
    try {
      const monitor = MonitorModel.getById(req.params.id);
      if (!monitor || !this.canAccess(monitor, req.user)) {
        return fail(res, 404, 'Monitor not found');
      }
      if (!this.monitorService) {
        return fail(res, 503, 'Service not initialized');
      }

      const result = await this.monitorService.executeCheck(monitor);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error checking monitor now:', error);
      fail(res, 500, 'Failed to execute check');
    }
  };

  // 删除监控项
  deleteMonitor = async (req, res) => {
    try {
      const monitor = MonitorModel.getById(req.params.id);
      if (!monitor || !this.canAccess(monitor, req.user, { write: true })) {
        return fail(res, 404, 'Monitor not found');
      }

      if (this.scheduler) {
        this.scheduler.unscheduleMonitor(monitor.id);
      }
      MonitorModel.delete(monitor.id);

      res.json({ success: true, message: 'Monitor deleted successfully' });
    } catch (error) {
      console.error('Error deleting monitor:', error);
      fail(res, 500, 'Failed to delete monitor');
    }
  };

  // 获取检测结果
  getCheckResults = async (req, res) => {
    try {
      const monitor = MonitorModel.getById(req.params.id);
      if (!monitor || !this.canAccess(monitor, req.user)) {
        return fail(res, 404, 'Monitor not found');
      }

      const limit = Math.min(1000, parseInt(req.query.limit) || 100);
      const results = MonitorModel.getCheckResults(monitor.id, limit);

      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Error getting check results:', error);
      fail(res, 500, 'Failed to get check results');
    }
  };

  // 获取统计数据
  getStats = async (req, res) => {
    try {
      const monitor = MonitorModel.getById(req.params.id);
      if (!monitor || !this.canAccess(monitor, req.user)) {
        return fail(res, 404, 'Monitor not found');
      }

      const range = parseInt(req.query.range) || 24;
      const hours = [24, 24 * 7, 24 * 30].includes(range) ? range : 24;

      const stats = StatisticsService.getMonitorStats(monitor.id);
      const trend = StatisticsService.getResponseTimeTrend(monitor.id, hours);

      res.json({ success: true, data: { ...stats, trend } });
    } catch (error) {
      console.error('Error getting stats:', error);
      fail(res, 500, 'Failed to get stats');
    }
  };

  // 获取故障事件
  getIncidents = async (req, res) => {
    try {
      const monitor = MonitorModel.getById(req.params.id);
      if (!monitor || !this.canAccess(monitor, req.user)) {
        return fail(res, 404, 'Monitor not found');
      }

      const limit = Math.min(200, parseInt(req.query.limit) || 50);
      const incidents = MonitorModel.getIncidents(monitor.id, limit);

      res.json({ success: true, data: incidents });
    } catch (error) {
      console.error('Error getting incidents:', error);
      fail(res, 500, 'Failed to get incidents');
    }
  };

  // 获取仪表盘数据
  getDashboard = async (req, res) => {
    try {
      const stats = StatisticsService.getDashboardStats();
      const monitors = MonitorModel.getAllForUser(req.user);
      const uptimeMap = StatisticsService.getUptime24hMap();

      const monitorsWithStatus = monitors.map(monitor => ({
        id: monitor.id,
        name: monitor.name,
        type: monitor.type,
        target: monitor.target,
        enabled: monitor.enabled,
        group_name: monitor.group_name,
        tags: monitor.tags ? JSON.parse(monitor.tags) : [],
        user_id: monitor.user_id,
        latestStatus: monitor.latest_status || 'unknown',
        latestResponseTime: monitor.latest_response_time ?? null,
        latestCheck: monitor.latest_check ?? null,
        uptime24h: uptimeMap[monitor.id] ?? null,
        inMaintenance: MaintenanceModel.isInMaintenance(monitor.id)
      }));

      res.json({
        success: true,
        data: { stats, monitors: monitorsWithStatus }
      });
    } catch (error) {
      console.error('Error getting dashboard:', error);
      fail(res, 500, 'Failed to get dashboard data');
    }
  };

  // 导出监控配置
  exportMonitors = async (req, res) => {
    try {
      const monitors = MonitorModel.getAllForUser(req.user).map(m => ({
        name: m.name,
        type: m.type,
        target: m.target,
        interval: m.interval,
        timeout: m.timeout,
        enabled: m.enabled,
        config: m.config ? JSON.parse(m.config) : null,
        description: m.description,
        group_name: m.group_name,
        tags: m.tags ? JSON.parse(m.tags) : [],
        max_retries: m.max_retries
      }));

      res.setHeader('Content-Disposition', 'attachment; filename="uptime-monitors.json"');
      res.json({
        version: 2,
        exportedAt: new Date().toISOString(),
        monitors
      });
    } catch (error) {
      console.error('Error exporting monitors:', error);
      fail(res, 500, 'Failed to export monitors');
    }
  };

  // 导入监控配置
  importMonitors = async (req, res) => {
    try {
      const list = req.body?.monitors;
      if (!Array.isArray(list) || list.length === 0) {
        return fail(res, 400, 'No monitors to import');
      }
      if (list.length > 500) {
        return fail(res, 400, 'Too many monitors (max 500 per import)');
      }

      let created = 0;
      const errors = [];

      for (const [index, item] of list.entries()) {
        const { error, value } = monitorSchema.validate(item);
        if (error) {
          errors.push(`#${index + 1}: ${error.details[0].message}`);
          continue;
        }
        const monitor = MonitorModel.create({ ...value, user_id: req.user.id });
        if (monitor.enabled && this.scheduler) {
          this.scheduler.scheduleMonitor(monitor);
        }
        created++;
      }

      res.json({
        success: true,
        data: { created, failed: errors.length, errors: errors.slice(0, 20) },
        message: `Imported ${created} monitors`
      });
    } catch (error) {
      console.error('Error importing monitors:', error);
      fail(res, 500, 'Failed to import monitors');
    }
  };
}

export default new MonitorController();

import Joi from 'joi';
import MonitorModel from '../models/Monitor.js';
import StatisticsService from '../services/statisticsService.js';

// 验证规则
const monitorSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  type: Joi.string().required().valid('http', 'tcp', 'ping'),
  target: Joi.string().required().min(1).max(500),
  interval: Joi.number().integer().min(10).max(86400).default(300),
  timeout: Joi.number().integer().min(1).max(300).default(30),
  enabled: Joi.number().integer().valid(0, 1).default(1),
  config: Joi.object().optional()
});

class MonitorController {
  constructor(schedulerService) {
    this.schedulerService = schedulerService;
  }

  // 获取所有监控项
  getAllMonitors = async (req, res) => {
    try {
      const monitors = MonitorModel.getAll();
      
      // 附加最新状态信息
      const monitorsWithStatus = monitors.map(monitor => {
        const latestResult = MonitorModel.getLatestCheckResult(monitor.id);
        return {
          ...monitor,
          config: monitor.config ? JSON.parse(monitor.config) : null,
          latestStatus: latestResult?.status || 'unknown',
          latestResponseTime: latestResult?.response_time || null,
          latestCheck: latestResult?.checked_at || null
        };
      });

      res.json({
        success: true,
        data: monitorsWithStatus
      });
    } catch (error) {
      console.error('Error getting monitors:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get monitors',
        error: error.message
      });
    }
  };

  // 获取单个监控项
  getMonitorById = async (req, res) => {
    try {
      const { id } = req.params;
      const monitor = MonitorModel.getById(id);

      if (!monitor) {
        return res.status(404).json({
          success: false,
          message: 'Monitor not found'
        });
      }

      res.json({
        success: true,
        data: {
          ...monitor,
          config: monitor.config ? JSON.parse(monitor.config) : null
        }
      });
    } catch (error) {
      console.error('Error getting monitor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get monitor',
        error: error.message
      });
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

      const monitor = MonitorModel.create(value);

      // 如果启用，添加到调度器
      if (monitor.enabled) {
        this.schedulerService.scheduleMonitor(monitor);
      }

      res.status(201).json({
        success: true,
        data: {
          ...monitor,
          config: monitor.config ? JSON.parse(monitor.config) : null
        },
        message: 'Monitor created successfully'
      });
    } catch (error) {
      console.error('Error creating monitor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create monitor',
        error: error.message
      });
    }
  };

  // 更新监控项
  updateMonitor = async (req, res) => {
    try {
      const { id } = req.params;
      const existing = MonitorModel.getById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Monitor not found'
        });
      }

      const { error, value } = monitorSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map(d => d.message)
        });
      }

      const monitor = MonitorModel.update(id, value);

      // 更新调度器
      this.schedulerService.unscheduleMonitor(id);
      if (monitor.enabled) {
        this.schedulerService.scheduleMonitor(monitor);
      }

      res.json({
        success: true,
        data: {
          ...monitor,
          config: monitor.config ? JSON.parse(monitor.config) : null
        },
        message: 'Monitor updated successfully'
      });
    } catch (error) {
      console.error('Error updating monitor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update monitor',
        error: error.message
      });
    }
  };

  // 切换启用/禁用
  toggleMonitor = async (req, res) => {
    try {
      const { id } = req.params;
      const monitor = MonitorModel.toggle(id);

      if (!monitor) {
        return res.status(404).json({
          success: false,
          message: 'Monitor not found'
        });
      }

      // 更新调度器
      this.schedulerService.unscheduleMonitor(id);
      if (monitor.enabled) {
        this.schedulerService.scheduleMonitor(monitor);
      }

      res.json({
        success: true,
        data: {
          ...monitor,
          config: monitor.config ? JSON.parse(monitor.config) : null
        },
        message: `Monitor ${monitor.enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      console.error('Error toggling monitor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle monitor',
        error: error.message
      });
    }
  };

  // 删除监控项
  deleteMonitor = async (req, res) => {
    try {
      const { id } = req.params;
      const monitor = MonitorModel.getById(id);

      if (!monitor) {
        return res.status(404).json({
          success: false,
          message: 'Monitor not found'
        });
      }

      // 先从调度器移除
      this.schedulerService.unscheduleMonitor(id);

      // 删除监控项
      MonitorModel.delete(id);

      res.json({
        success: true,
        message: 'Monitor deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting monitor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete monitor',
        error: error.message
      });
    }
  };

  // 获取检测结果
  getCheckResults = async (req, res) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 100;

      const monitor = MonitorModel.getById(id);
      if (!monitor) {
        return res.status(404).json({
          success: false,
          message: 'Monitor not found'
        });
      }

      const results = MonitorModel.getCheckResults(id, limit);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Error getting check results:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get check results',
        error: error.message
      });
    }
  };

  // 获取统计数据
  getStats = async (req, res) => {
    try {
      const { id } = req.params;

      const monitor = MonitorModel.getById(id);
      if (!monitor) {
        return res.status(404).json({
          success: false,
          message: 'Monitor not found'
        });
      }

      const stats = StatisticsService.getMonitorStats(id);
      const trend = StatisticsService.getResponseTimeTrend(id, 24);

      res.json({
        success: true,
        data: {
          ...stats,
          trend
        }
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get stats',
        error: error.message
      });
    }
  };

  // 获取故障事件
  getIncidents = async (req, res) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 50;

      const monitor = MonitorModel.getById(id);
      if (!monitor) {
        return res.status(404).json({
          success: false,
          message: 'Monitor not found'
        });
      }

      const incidents = MonitorModel.getIncidents(id, limit);

      res.json({
        success: true,
        data: incidents
      });
    } catch (error) {
      console.error('Error getting incidents:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get incidents',
        error: error.message
      });
    }
  };

  // 获取仪表盘数据
  getDashboard = async (req, res) => {
    try {
      const stats = StatisticsService.getDashboardStats();
      const monitors = MonitorModel.getAll();

      // 附加每个监控项的状态
      const monitorsWithStatus = monitors.map(monitor => {
        const latestResult = MonitorModel.getLatestCheckResult(monitor.id);
        const uptime = StatisticsService.calculateUptime(monitor.id, 24);
        
        return {
          id: monitor.id,
          name: monitor.name,
          type: monitor.type,
          target: monitor.target,
          enabled: monitor.enabled,
          latestStatus: latestResult?.status || 'unknown',
          latestResponseTime: latestResult?.response_time || null,
          latestCheck: latestResult?.checked_at || null,
          uptime24h: uptime.percentage
        };
      });

      res.json({
        success: true,
        data: {
          stats,
          monitors: monitorsWithStatus
        }
      });
    } catch (error) {
      console.error('Error getting dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard data',
        error: error.message
      });
    }
  };
}

export default MonitorController;

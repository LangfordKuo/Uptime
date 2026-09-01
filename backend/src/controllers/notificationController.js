import Joi from 'joi';
import NotificationChannelModel from '../models/NotificationChannel.js';
import NotificationService from '../services/notificationService.js';

const CHANNEL_TYPES = ['email', 'telegram', 'webhook', 'dingtalk', 'feishu', 'wecom'];

const createSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  type: Joi.string().required().valid(...CHANNEL_TYPES),
  config: Joi.object().default({}),
  enabled: Joi.boolean().default(true),
  monitor_ids: Joi.array().items(Joi.number().integer()).optional()
});

const updateSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  type: Joi.string().valid(...CHANNEL_TYPES),
  config: Joi.object(),
  enabled: Joi.boolean(),
  monitor_ids: Joi.array().items(Joi.number().integer())
});

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

class NotificationController {
  // 渠道列表
  getAll = async (req, res) => {
    try {
      const channels = NotificationChannelModel.getAll().map(c =>
        NotificationChannelModel.decorate(c)
      );
      res.json({ success: true, data: channels });
    } catch (error) {
      console.error('Error getting channels:', error);
      fail(res, 500, '获取通知渠道失败');
    }
  };

  // 创建渠道
  create = async (req, res) => {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: '验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      const { monitor_ids, ...data } = value;
      const channel = NotificationChannelModel.create(data);
      if (monitor_ids !== undefined) {
        NotificationChannelModel.setMonitors(channel.id, monitor_ids);
      }

      res.status(201).json({
        success: true,
        data: NotificationChannelModel.decorate(channel),
        message: '通知渠道创建成功'
      });
    } catch (error) {
      console.error('Error creating channel:', error);
      fail(res, 500, '创建通知渠道失败');
    }
  };

  // 更新渠道（masked 字段 '******' 保留原值）
  update = async (req, res) => {
    try {
      const existing = NotificationChannelModel.getById(req.params.id);
      if (!existing) return fail(res, 404, '通知渠道不存在');

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: '验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      // 配置合并：masked 的密钥字段保留数据库中的原值
      if (value.config) {
        const oldConfig = JSON.parse(existing.config || '{}');
        const merged = { ...oldConfig, ...value.config };
        for (const key of ['smtpPass', 'botToken', 'secret']) {
          if (value.config[key] === '******' && oldConfig[key]) {
            merged[key] = oldConfig[key];
          }
        }
        // 清理 mask 标记
        for (const key of Object.keys(merged)) {
          if (key.endsWith('__masked')) delete merged[key];
        }
        value.config = merged;
      }

      const { monitor_ids, ...data } = value;
      const channel = NotificationChannelModel.update(existing.id, data);
      if (monitor_ids !== undefined) {
        NotificationChannelModel.setMonitors(existing.id, monitor_ids);
      }

      res.json({
        success: true,
        data: NotificationChannelModel.decorate(channel),
        message: '通知渠道已更新'
      });
    } catch (error) {
      console.error('Error updating channel:', error);
      fail(res, 500, '更新通知渠道失败');
    }
  };

  // 删除渠道
  delete = async (req, res) => {
    try {
      const success = NotificationChannelModel.delete(req.params.id);
      if (!success) return fail(res, 404, '通知渠道不存在');
      res.json({ success: true, message: '通知渠道已删除' });
    } catch (error) {
      console.error('Error deleting channel:', error);
      fail(res, 500, '删除通知渠道失败');
    }
  };

  // 发送测试消息
  test = async (req, res) => {
    try {
      const channel = NotificationChannelModel.getById(req.params.id);
      if (!channel) return fail(res, 404, '通知渠道不存在');

      await NotificationService.send(
        channel,
        '【测试】Uptime 监控通知',
        `这是一条测试消息。\n渠道：${channel.name} (${channel.type})\n时间：${new Date().toLocaleString()}`
      );
      res.json({ success: true, message: '测试消息已发送' });
    } catch (error) {
      console.error('Error testing channel:', error);
      res.status(500).json({
        success: false,
        message: `测试消息发送失败: ${error.message}`
      });
    }
  };
}

export default new NotificationController();

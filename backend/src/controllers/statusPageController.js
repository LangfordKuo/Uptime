import Joi from 'joi';
import StatusPageModel from '../models/StatusPage.js';
import MaintenanceModel from '../models/Maintenance.js';

// 验证规则
const createSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  slug: Joi.string().required().min(1).max(50).pattern(/^[a-z0-9-]+$/).messages({
    'string.pattern.base': 'Slug 只能包含小写字母、数字和连字符'
  }),
  description: Joi.string().allow('').max(500),
  logo_url: Joi.string().allow('').max(500),
  password: Joi.string().allow('').max(100),
  is_public: Joi.boolean().default(true),
  monitor_ids: Joi.array().items(Joi.number()).default([])
});

const updateSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  slug: Joi.string().min(1).max(50).pattern(/^[a-z0-9-]+$/).messages({
    'string.pattern.base': 'Slug 只能包含小写字母、数字和连字符'
  }),
  description: Joi.string().allow('').max(500),
  logo_url: Joi.string().allow('').max(500),
  password: Joi.string().allow('').max(100),
  is_public: Joi.boolean(),
  monitor_ids: Joi.array().items(Joi.number())
});

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

class StatusPageController {
  // 获取所有状态页
  getAllStatusPages = async (req, res) => {
    try {
      const statusPages = StatusPageModel.getAll().map(sp => ({
        ...sp,
        has_password: !!sp.password_hash,
        password_hash: undefined
      }));
      res.json({ success: true, data: statusPages });
    } catch (error) {
      console.error('Error getting status pages:', error);
      fail(res, 500, '获取状态页列表失败');
    }
  };

  // 获取单个状态页（管理后台用）
  getStatusPageById = async (req, res) => {
    try {
      const statusPage = StatusPageModel.getById(req.params.id);

      if (!statusPage) {
        return fail(res, 404, '状态页不存在');
      }

      const monitors = StatusPageModel.getMonitors(statusPage.id);

      res.json({
        success: true,
        data: {
          ...statusPage,
          has_password: !!statusPage.password_hash,
          password_hash: undefined,
          monitors
        }
      });
    } catch (error) {
      console.error('Error getting status page:', error);
      fail(res, 500, '获取状态页失败');
    }
  };

  // 获取公开状态页（访客访问，支持密码保护）
  // 密码通过 POST body {password} 或 GET ?password= 传递
  getPublicStatusPage = async (req, res) => {
    try {
      const { slug } = req.params;
      const statusPage = StatusPageModel.getBySlug(slug);

      if (!statusPage) {
        return fail(res, 404, '状态页不存在或未公开');
      }

      // 密码校验
      if (statusPage.password_hash) {
        const password = req.body?.password ?? req.query?.password;
        if (!StatusPageModel.verifyPassword(statusPage, password)) {
          return res.status(401).json({
            success: false,
            message: '此状态页需要密码访问',
            needsPassword: true
          });
        }
      }

      const monitors = StatusPageModel.getMonitors(statusPage.id);
      const recentIncidents = StatusPageModel.getRecentIncidents(statusPage.id, 10);

      // 标记维护中的监控项
      const monitorsWithMaintenance = monitors.map(m => ({
        ...m,
        in_maintenance: MaintenanceModel.isInMaintenance(m.id)
      }));

      // 计算最新的更新时间（取所有监控项中最新的检查时间）
      let latestUpdate = statusPage.updated_at || statusPage.created_at;
      monitors.forEach(monitor => {
        if (monitor.latest_check && monitor.latest_check > latestUpdate) {
          latestUpdate = monitor.latest_check;
        }
      });

      res.json({
        success: true,
        data: {
          id: statusPage.id,
          name: statusPage.name,
          slug: statusPage.slug,
          description: statusPage.description,
          logo_url: statusPage.logo_url,
          created_at: statusPage.created_at,
          updated_at: latestUpdate,
          monitors: monitorsWithMaintenance,
          recent_incidents: recentIncidents
        }
      });
    } catch (error) {
      console.error('Error getting public status page:', error);
      fail(res, 500, '获取状态页失败');
    }
  };

  // 创建状态页
  createStatusPage = async (req, res) => {
    try {
      const { error, value } = createSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          message: '验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      if (StatusPageModel.slugExists(value.slug)) {
        return fail(res, 400, 'Slug 已被使用，请选择其他名称');
      }

      const statusPage = StatusPageModel.create({
        ...value,
        created_by: req.user.id
      });

      res.status(201).json({
        success: true,
        data: { ...statusPage, password_hash: undefined },
        message: '状态页创建成功'
      });
    } catch (error) {
      console.error('Error creating status page:', error);
      fail(res, 500, '创建状态页失败');
    }
  };

  // 更新状态页
  updateStatusPage = async (req, res) => {
    try {
      const existing = StatusPageModel.getById(req.params.id);

      if (!existing) {
        return fail(res, 404, '状态页不存在');
      }

      const { error, value } = updateSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          message: '验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      if (value.slug && value.slug !== existing.slug) {
        if (StatusPageModel.slugExists(value.slug, existing.id)) {
          return fail(res, 400, 'Slug 已被使用，请选择其他名称');
        }
      }

      const statusPage = StatusPageModel.update(existing.id, value);

      res.json({
        success: true,
        data: { ...statusPage, password_hash: undefined },
        message: '状态页更新成功'
      });
    } catch (error) {
      console.error('Error updating status page:', error);
      fail(res, 500, '更新状态页失败');
    }
  };

  // 删除状态页
  deleteStatusPage = async (req, res) => {
    try {
      const existing = StatusPageModel.getById(req.params.id);

      if (!existing) {
        return fail(res, 404, '状态页不存在');
      }

      StatusPageModel.delete(existing.id);

      res.json({ success: true, message: '状态页删除成功' });
    } catch (error) {
      console.error('Error deleting status page:', error);
      fail(res, 500, '删除状态页失败');
    }
  };
}

export default new StatusPageController();

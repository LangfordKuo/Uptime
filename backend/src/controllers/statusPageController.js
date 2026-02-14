import Joi from 'joi';
import StatusPageModel from '../models/StatusPage.js';

// 验证规则
const createSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  slug: Joi.string().required().min(1).max(50).pattern(/^[a-z0-9-]+$/).messages({
    'string.pattern.base': 'Slug 只能包含小写字母、数字和连字符'
  }),
  description: Joi.string().allow('').max(500),
  logo_url: Joi.string().allow('').max(500),
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
  is_public: Joi.boolean(),
  monitor_ids: Joi.array().items(Joi.number())
});

class StatusPageController {
  // 获取所有状态页
  getAllStatusPages = async (req, res) => {
    try {
      const statusPages = StatusPageModel.getAll();
      res.json({
        success: true,
        data: statusPages
      });
    } catch (error) {
      console.error('Error getting status pages:', error);
      res.status(500).json({
        success: false,
        message: '获取状态页列表失败',
        error: error.message
      });
    }
  };

  // 获取单个状态页（管理后台用）
  getStatusPageById = async (req, res) => {
    try {
      const { id } = req.params;
      const statusPage = StatusPageModel.getById(id);

      if (!statusPage) {
        return res.status(404).json({
          success: false,
          message: '状态页不存在'
        });
      }

      // 获取关联的监控项
      const monitors = StatusPageModel.getMonitors(id);

      res.json({
        success: true,
        data: {
          ...statusPage,
          monitors
        }
      });
    } catch (error) {
      console.error('Error getting status page:', error);
      res.status(500).json({
        success: false,
        message: '获取状态页失败',
        error: error.message
      });
    }
  };

  // 获取公开状态页（访客访问）
  getPublicStatusPage = async (req, res) => {
    try {
      const { slug } = req.params;
      const statusPage = StatusPageModel.getBySlug(slug);

      if (!statusPage) {
        return res.status(404).json({
          success: false,
          message: '状态页不存在或未公开'
        });
      }

      // 获取关联的监控项
      const monitors = StatusPageModel.getMonitors(statusPage.id);

      // 计算最新的更新时间（取所有监控项中最新的检查时间）
      let latestUpdate = statusPage.updated_at || statusPage.created_at;
      monitors.forEach(monitor => {
        if (monitor.latest_check) {
          const checkTime = new Date(monitor.latest_check);
          const currentLatest = new Date(latestUpdate);
          if (checkTime > currentLatest) {
            latestUpdate = monitor.latest_check;
          }
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
          monitors
        }
      });
    } catch (error) {
      console.error('Error getting public status page:', error);
      res.status(500).json({
        success: false,
        message: '获取状态页失败',
        error: error.message
      });
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

      // 检查 slug 是否已存在
      if (StatusPageModel.slugExists(value.slug)) {
        return res.status(400).json({
          success: false,
          message: 'Slug 已被使用，请选择其他名称'
        });
      }

      const statusPage = StatusPageModel.create({
        ...value,
        created_by: req.user.id
      });

      res.status(201).json({
        success: true,
        data: statusPage,
        message: '状态页创建成功'
      });
    } catch (error) {
      console.error('Error creating status page:', error);
      res.status(500).json({
        success: false,
        message: '创建状态页失败',
        error: error.message
      });
    }
  };

  // 更新状态页
  updateStatusPage = async (req, res) => {
    try {
      const { id } = req.params;
      const existing = StatusPageModel.getById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: '状态页不存在'
        });
      }

      const { error, value } = updateSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: '验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      // 如果修改了 slug，检查是否已存在
      if (value.slug && value.slug !== existing.slug) {
        if (StatusPageModel.slugExists(value.slug, id)) {
          return res.status(400).json({
            success: false,
            message: 'Slug 已被使用，请选择其他名称'
          });
        }
      }

      const statusPage = StatusPageModel.update(id, value);

      res.json({
        success: true,
        data: statusPage,
        message: '状态页更新成功'
      });
    } catch (error) {
      console.error('Error updating status page:', error);
      res.status(500).json({
        success: false,
        message: '更新状态页失败',
        error: error.message
      });
    }
  };

  // 删除状态页
  deleteStatusPage = async (req, res) => {
    try {
      const { id } = req.params;
      const existing = StatusPageModel.getById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: '状态页不存在'
        });
      }

      StatusPageModel.delete(id);

      res.json({
        success: true,
        message: '状态页删除成功'
      });
    } catch (error) {
      console.error('Error deleting status page:', error);
      res.status(500).json({
        success: false,
        message: '删除状态页失败',
        error: error.message
      });
    }
  };
}

export default new StatusPageController();

import Joi from 'joi';
import UserModel from '../models/User.js';
import { ensureDatabaseOpen, isInstalled } from '../models/database.js';
import { rotateJwtSecret } from '../middleware/auth.js';
import { initServices } from '../container.js';

// 验证规则
const installSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6).max(100),
  confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
    'any.only': '两次密码输入不一致'
  })
});

class InstallController {
  // 检查是否已安装
  checkInstalled(req, res) {
    res.json({
      success: true,
      data: {
        installed: isInstalled()
      }
    });
  }

  // 执行安装
  async install(req, res) {
    try {
      // 检查是否已安装
      if (isInstalled()) {
        return res.status(400).json({
          success: false,
          message: '系统已安装，请勿重复安装'
        });
      }

      // 验证输入
      const { error, value } = installSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: '验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      const { username, email, password } = value;

      // 打开数据库并创建表结构
      ensureDatabaseOpen();

      // 生成随机 JWT Secret 并持久化，替代旧的硬编码默认值
      rotateJwtSecret();

      // 创建管理员账户
      const user = await UserModel.create({
        username,
        email,
        password,
        role: 'admin'
      });

      // 热启动监控服务、调度器和备份，无需重启进程
      initServices();

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        },
        message: '安装成功，监控服务已启动'
      });
    } catch (error) {
      console.error('Install error:', error);
      res.status(500).json({
        success: false,
        message: '安装失败'
      });
    }
  }
}

export default new InstallController();

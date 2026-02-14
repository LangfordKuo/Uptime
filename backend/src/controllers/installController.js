import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Joi from 'joi';
import UserModel from '../models/User.js';
import { createDatabaseTables } from '../models/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../database/uptime.db');

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
    const installed = fs.existsSync(dbPath);
    res.json({
      success: true,
      data: {
        installed
      }
    });
  }

  // 执行安装
  async install(req, res) {
    try {
      // 检查是否已安装
      if (fs.existsSync(dbPath)) {
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

      // 创建数据库表结构
      await createDatabaseTables();

      // 创建管理员账户
      const user = await UserModel.create({
        username,
        email,
        password,
        role: 'admin'
      });

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
        message: '安装成功'
      });
    } catch (error) {
      console.error('Install error:', error);
      res.status(500).json({
        success: false,
        message: '安装失败',
        error: error.message
      });
    }
  }
}

export default new InstallController();

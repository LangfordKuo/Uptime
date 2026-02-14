import Joi from 'joi';
import UserModel from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

// 验证规则
const loginSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  password: Joi.string().required().min(6)
});

const registerSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6).max(100),
  role: Joi.string().valid('user', 'viewer').default('user')
});

class AuthController {
  // 用户登录
  async login(req, res) {
    try {
      const { error, value } = loginSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: '验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      const { username, password } = value;
      
      // 查找用户
      const user = UserModel.getByUsername(username);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 验证密码
      const isValid = await UserModel.verifyPassword(password, user.password);
      
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 生成 token
      const token = generateToken(user);

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        },
        message: '登录成功'
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: '登录失败',
        error: error.message
      });
    }
  }

  // 用户注册（仅管理员可创建新用户）
  async register(req, res) {
    try {
      const { error, value } = registerSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: '验证失败',
          errors: error.details.map(d => d.message)
        });
      }

      const { username, email, password, role } = value;

      // 检查用户名是否已存在
      if (UserModel.getByUsername(username)) {
        return res.status(400).json({
          success: false,
          message: '用户名已存在'
        });
      }

      // 检查邮箱是否已存在
      if (UserModel.getByEmail(email)) {
        return res.status(400).json({
          success: false,
          message: '邮箱已被注册'
        });
      }

      // 创建用户
      const user = await UserModel.create({ username, email, password, role });

      res.status(201).json({
        success: true,
        data: user,
        message: '用户创建成功'
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        message: '注册失败',
        error: error.message
      });
    }
  }

  // 获取当前用户信息
  getCurrentUser(req, res) {
    res.json({
      success: true,
      data: req.user
    });
  }

  // 获取所有用户（仅管理员）
  getAllUsers(req, res) {
    try {
      const users = UserModel.getAll();
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: '获取用户列表失败',
        error: error.message
      });
    }
  }

  // 删除用户（仅管理员）
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // 不能删除自己
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({
          success: false,
          message: '不能删除当前登录用户'
        });
      }

      const success = UserModel.delete(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      res.json({
        success: true,
        message: '用户删除成功'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: '删除用户失败',
        error: error.message
      });
    }
  }

  // 修改用户名（管理员可修改任何人，普通用户只能修改自己）
  async updateUsername(req, res) {
    try {
      const { id } = req.params;
      const { username } = req.body;

      // 权限检查：非管理员只能修改自己
      if (req.user.role !== 'admin' && parseInt(id) !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权修改其他用户信息'
        });
      }

      // 验证用户名
      if (!username || username.length < 3 || username.length > 50) {
        return res.status(400).json({
          success: false,
          message: '用户名长度必须在3-50个字符之间'
        });
      }

      // 检查用户名是否已被使用
      const existingUser = UserModel.getByUsername(username);
      if (existingUser && existingUser.id !== parseInt(id)) {
        return res.status(400).json({
          success: false,
          message: '用户名已被使用'
        });
      }

      // 更新用户名
      const user = UserModel.getById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      const updatedUser = UserModel.update(id, { 
        email: user.email, 
        role: user.role,
        username 
      });

      res.json({
        success: true,
        data: updatedUser,
        message: '用户名修改成功'
      });
    } catch (error) {
      console.error('Update username error:', error);
      res.status(500).json({
        success: false,
        message: '修改用户名失败',
        error: error.message
      });
    }
  }

  // 修改密码
  async updatePassword(req, res) {
    try {
      const { id } = req.params;
      const { oldPassword, newPassword, confirmPassword } = req.body;

      // 权限检查：非管理员只能修改自己的密码
      if (req.user.role !== 'admin' && parseInt(id) !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权修改其他用户密码'
        });
      }

      // 验证新密码
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: '新密码长度至少6个字符'
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: '两次密码输入不一致'
        });
      }

      // 获取用户
      const user = UserModel.getById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 非管理员修改自己密码时需要验证旧密码
      if (req.user.role !== 'admin' || parseInt(id) === req.user.id) {
        if (!oldPassword) {
          return res.status(400).json({
            success: false,
            message: '请输入当前密码'
          });
        }

        // 获取完整用户信息（包含密码）
        const fullUser = UserModel.getByUsername(user.username);
        const isValid = await UserModel.verifyPassword(oldPassword, fullUser.password);
        if (!isValid) {
          return res.status(401).json({
            success: false,
            message: '当前密码错误'
          });
        }
      }

      // 更新密码
      await UserModel.updatePassword(id, newPassword);

      res.json({
        success: true,
        message: '密码修改成功'
      });
    } catch (error) {
      console.error('Update password error:', error);
      res.status(500).json({
        success: false,
        message: '修改密码失败',
        error: error.message
      });
    }
  }
}

export default new AuthController();

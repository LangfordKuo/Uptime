import jwt from 'jsonwebtoken';
import UserModel from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'uptime-monitor-secret-key-change-in-production';

// 生成 JWT Token
export function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 验证 Token 中间件
export function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = UserModel.getById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '无效的认证令牌'
    });
  }
}

// 权限验证中间件工厂
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    next();
  };
}

// 可选认证中间件（允许访客访问，但会尝试解析token）
export function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = UserModel.getById(decoded.id);
        if (user) {
          req.user = user;
        }
      } catch (dbError) {
        // 数据库可能不存在或表不存在，忽略错误
        console.log('Optional auth DB error (ignored):', dbError.message);
      }
    }
  } catch (error) {
    // 忽略错误，允许继续访问
  }
  
  next();
}

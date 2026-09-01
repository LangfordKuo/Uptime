import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../models/database.js';

// JWT Secret：优先环境变量，否则使用数据库中保存的随机密钥（安装时生成）。
// 好处：不再有硬编码默认密钥；安装即安全。
let cachedSecret = null;

export function loadJwtSecret() {
  if (process.env.JWT_SECRET) {
    cachedSecret = process.env.JWT_SECRET;
    return cachedSecret;
  }
  try {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'jwt_secret'").get();
    if (row && row.value) {
      cachedSecret = row.value;
      return cachedSecret;
    }
  } catch (err) {
    // 数据库尚未安装，忽略
  }
  return null;
}

export function getJwtSecret() {
  if (cachedSecret) return cachedSecret;
  return loadJwtSecret();
}

// 生成并保存随机 JWT Secret（安装时调用）
export function rotateJwtSecret() {
  const secret = crypto.randomBytes(48).toString('hex');
  db.prepare(`
    INSERT INTO system_settings (key, value) VALUES ('jwt_secret', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(secret);
  cachedSecret = secret;
  return secret;
}

// 生成 JWT Token
export function generateToken(user) {
  const secret = getJwtSecret() || 'insecure-dev-secret';
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    secret,
    { expiresIn: '7d' }
  );
}

function verifyJwt(token) {
  const secret = getJwtSecret();
  if (!secret) return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

// 查库校验用户仍然有效且角色是最新的。
// 这样删除用户、修改角色后旧 Token 立即失效，不必等 7 天过期。
function resolveUserFromToken(decoded) {
  if (!decoded || !decoded.id) return null;
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(decoded.id);
  return user || null;
}

function resolveApiKey(key) {
  if (!key) return null;
  const row = db.prepare('SELECT id, name FROM api_keys WHERE key = ?').get(key);
  if (!row) return null;
  db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?').run(row.id);
  return { id: 0, username: `api-key:${row.name}`, role: 'viewer', apiKey: true };
}

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

function extractApiKey(req) {
  if (req.headers['x-api-key']) return String(req.headers['x-api-key']);
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ') && !header.includes('.')) {
    // Bearer 后面不是 JWT（没有两个点）时按 API Key 处理
    return header.slice(7);
  }
  return null;
}

// 验证 Token 中间件
export function authenticate(req, res, next) {
  try {
    // API Key 认证（只读权限，角色为 viewer）
    const apiKey = extractApiKey(req);
    if (apiKey && !extractToken(req)) {
      const keyUser = resolveApiKey(apiKey);
      if (keyUser) {
        req.user = keyUser;
        return next();
      }
      return res.status(401).json({ success: false, message: '无效的 API Key' });
    }

    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    const decoded = verifyJwt(token);
    const user = resolveUserFromToken(decoded);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '无效的认证令牌'
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

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
    const apiKey = extractApiKey(req);
    if (apiKey && !extractToken(req)) {
      req.user = resolveApiKey(apiKey);
      return next();
    }

    const token = extractToken(req);
    if (token) {
      const decoded = verifyJwt(token);
      const user = resolveUserFromToken(decoded);
      if (user) {
        req.user = { id: user.id, username: user.username, role: user.role };
      }
    }
  } catch (error) {
    // 忽略错误，允许继续访问
  }

  next();
}

// Socket.io 鉴权（握手时携带 token）
export function socketAuth(token) {
  const decoded = verifyJwt(token);
  return resolveUserFromToken(decoded);
}

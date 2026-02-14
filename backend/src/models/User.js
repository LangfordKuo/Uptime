import db from './database.js';
import bcrypt from 'bcryptjs';

class UserModel {
  // 根据用户名获取用户
  static getByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  // 根据邮箱获取用户
  static getByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  // 根据ID获取用户
  static getById(id) {
    const stmt = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  }

  // 创建用户
  static async create(data) {
    const { username, email, password, role = 'user' } = data;
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password, role)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(username, email, hashedPassword, role);
    console.log('User created, result:', result);
    
    if (!result.lastInsertRowid) {
      throw new Error('Failed to get last insert ID');
    }
    
    return this.getById(result.lastInsertRowid);
  }

  // 验证密码
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // 更新用户信息
  static update(id, data) {
    const { email, role, username } = data;
    
    // 构建更新语句
    const fields = [];
    const values = [];
    
    if (username !== undefined) {
      fields.push('username = ?');
      values.push(username);
    }
    if (email !== undefined) {
      fields.push('email = ?');
      values.push(email);
    }
    if (role !== undefined) {
      fields.push('role = ?');
      values.push(role);
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(...values);
    return this.getById(id);
  }

  // 修改密码
  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const stmt = db.prepare(`
      UPDATE users 
      SET password = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(hashedPassword, id);
    return true;
  }

  // 删除用户
  static delete(id) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // 获取所有用户（不包含密码）
  static getAll() {
    const stmt = db.prepare('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC');
    return stmt.all();
  }
}

export default UserModel;

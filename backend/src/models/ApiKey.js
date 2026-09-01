import crypto from 'crypto';
import db from './database.js';

class ApiKeyModel {
  static getAll() {
    // 列表不返回完整 key，只返回前 8 位供辨认
    return db.prepare(`
      SELECT id, name, substr(key, 1, 8) || '...' as key_preview,
             created_at, last_used_at
      FROM api_keys ORDER BY created_at DESC
    `).all();
  }

  static create(name) {
    const key = 'upt_' + crypto.randomBytes(24).toString('hex');
    const result = db.prepare(
      'INSERT INTO api_keys (name, key) VALUES (?, ?)'
    ).run(name, key);
    // 创建接口返回完整 key（仅此一次）
    return { id: result.lastInsertRowid, name, key, created_at: new Date().toISOString() };
  }

  static delete(id) {
    const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

export default ApiKeyModel;

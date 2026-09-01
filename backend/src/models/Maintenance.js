import db from './database.js';

class MaintenanceModel {
  // 获取监控项的所有维护窗口
  static getAll(monitorId = null) {
    if (monitorId) {
      return db.prepare(`
        SELECT * FROM maintenance_windows
        WHERE monitor_id = ?
        ORDER BY start_at ASC
      `).all(monitorId);
    }
    return db.prepare(`
      SELECT mw.*, m.name as monitor_name
      FROM maintenance_windows mw
      LEFT JOIN monitors m ON mw.monitor_id = m.id
      ORDER BY mw.start_at ASC
    `).all();
  }

  static getById(id) {
    return db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id);
  }

  // 创建维护窗口（start_at/end_at 为 ISO UTC 字符串）
  static create(monitorId, { name, start_at, end_at }) {
    const result = db.prepare(`
      INSERT INTO maintenance_windows (monitor_id, name, start_at, end_at)
      VALUES (?, ?, ?, ?)
    `).run(monitorId, name || '', new Date(start_at).toISOString(), new Date(end_at).toISOString());
    return this.getById(result.lastInsertRowid);
  }

  static delete(id) {
    const result = db.prepare('DELETE FROM maintenance_windows WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // 判断监控项当前是否处于维护窗口内
  static isInMaintenance(monitorId, now = new Date()) {
    const row = db.prepare(`
      SELECT COUNT(*) as count
      FROM maintenance_windows
      WHERE monitor_id = ?
        AND datetime(start_at) <= datetime(?)
        AND datetime(end_at) >= datetime(?)
    `).get(monitorId, now.toISOString(), now.toISOString());
    return row.count > 0;
  }
}

export default MaintenanceModel;

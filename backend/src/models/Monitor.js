import db from './database.js';

class MonitorModel {
  // 获取所有监控项
  static getAll() {
    const stmt = db.prepare('SELECT * FROM monitors ORDER BY created_at DESC');
    return stmt.all();
  }

  // 根据ID获取监控项
  static getById(id) {
    const stmt = db.prepare('SELECT * FROM monitors WHERE id = ?');
    return stmt.get(id);
  }

  // 获取所有启用的监控项
  static getEnabled() {
    const stmt = db.prepare('SELECT * FROM monitors WHERE enabled = 1');
    return stmt.all();
  }

  // 创建监控项
  static create(data) {
    const { name, type, target, interval, timeout, enabled, config } = data;
    const stmt = db.prepare(`
      INSERT INTO monitors (name, type, target, interval, timeout, enabled, config)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const configStr = config ? JSON.stringify(config) : null;
    const result = stmt.run(name, type, target, interval || 300, timeout || 30, enabled !== undefined ? enabled : 1, configStr);
    
    return this.getById(result.lastInsertRowid);
  }

  // 更新监控项
  static update(id, data) {
    const { name, type, target, interval, timeout, enabled, config } = data;
    const configStr = config ? JSON.stringify(config) : null;
    
    const stmt = db.prepare(`
      UPDATE monitors 
      SET name = ?, type = ?, target = ?, interval = ?, timeout = ?, enabled = ?, config = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(name, type, target, interval, timeout, enabled, configStr, id);
    return this.getById(id);
  }

  // 切换启用/禁用状态
  static toggle(id) {
    const monitor = this.getById(id);
    if (!monitor) return null;
    
    const stmt = db.prepare('UPDATE monitors SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(monitor.enabled ? 0 : 1, id);
    
    return this.getById(id);
  }

  // 删除监控项
  static delete(id) {
    const stmt = db.prepare('DELETE FROM monitors WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // 记录检测结果
  static recordCheckResult(monitorId, result) {
    const { status, responseTime, statusCode, errorMessage } = result;
    const stmt = db.prepare(`
      INSERT INTO check_results (monitor_id, status, response_time, status_code, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    return stmt.run(monitorId, status, responseTime || null, statusCode || null, errorMessage || null);
  }

  // 获取检测历史
  static getCheckResults(monitorId, limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM check_results 
      WHERE monitor_id = ? 
      ORDER BY checked_at DESC 
      LIMIT ?
    `);
    return stmt.all(monitorId, limit);
  }

  // 获取最新检测结果
  static getLatestCheckResult(monitorId) {
    const stmt = db.prepare(`
      SELECT * FROM check_results 
      WHERE monitor_id = ? 
      ORDER BY checked_at DESC 
      LIMIT 1
    `);
    return stmt.get(monitorId);
  }

  // 创建故障事件
  static createIncident(monitorId) {
    const stmt = db.prepare(`
      INSERT INTO incidents (monitor_id, started_at)
      VALUES (?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(monitorId);
  }

  // 结束故障事件
  static endIncident(monitorId) {
    const stmt = db.prepare(`
      UPDATE incidents 
      SET ended_at = CURRENT_TIMESTAMP,
          duration = (julianday(CURRENT_TIMESTAMP) - julianday(started_at)) * 86400
      WHERE monitor_id = ? AND ended_at IS NULL
    `);
    return stmt.run(monitorId);
  }

  // 获取当前进行中的故障
  static getActiveIncident(monitorId) {
    const stmt = db.prepare(`
      SELECT * FROM incidents 
      WHERE monitor_id = ? AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `);
    return stmt.get(monitorId);
  }

  // 获取故障历史
  static getIncidents(monitorId, limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM incidents 
      WHERE monitor_id = ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    return stmt.all(monitorId, limit);
  }

  // 清理旧数据（保留指定天数）
  static cleanOldData(days = 30) {
    const stmt = db.prepare(`
      DELETE FROM check_results 
      WHERE checked_at < datetime('now', '-' || ? || ' days')
    `);
    const result = stmt.run(days);
    return result.changes;
  }
}

export default MonitorModel;

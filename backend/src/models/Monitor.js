import db from './database.js';
import { generatePushToken } from '../utils/checkUtils.js';

class MonitorModel {
  // 获取所有监控项（附带最新检测结果，单条 SQL 避免 N+1 查询）
  static getAll() {
    return db.prepare(`
      SELECT m.*,
        cr.status as latest_status,
        cr.response_time as latest_response_time,
        cr.status_code as latest_status_code,
        cr.checked_at as latest_check,
        cr.extra as latest_extra,
        (SELECT GROUP_CONCAT(mc.channel_id) FROM monitor_channels mc WHERE mc.monitor_id = m.id) as channel_ids
      FROM monitors m
      LEFT JOIN check_results cr ON cr.id = (
        SELECT id FROM check_results WHERE monitor_id = m.id ORDER BY id DESC LIMIT 1
      )
      ORDER BY m.created_at DESC
    `).all();
  }

  // 根据用户角色过滤监控列表
  // admin 看全部；user 只看自己创建的和未设置归属的；viewer 只读看全部
  static getAllForUser(user) {
    const monitors = this.getAll();
    if (!user || user.role === 'admin' || user.role === 'viewer') {
      return monitors;
    }
    return monitors.filter(m => m.user_id === null || m.user_id === user.id);
  }

  // 根据 ID 获取监控项
  static getById(id) {
    return db.prepare('SELECT * FROM monitors WHERE id = ?').get(id);
  }

  // 根据类型获取监控项
  static getByType(type) {
    return db.prepare('SELECT * FROM monitors WHERE type = ?').all(type);
  }

  // 根据 push token 获取监控项
  static getByPushToken(token) {
    return db.prepare('SELECT * FROM monitors WHERE push_token = ?').get(token);
  }

  // 获取所有启用的监控项
  static getEnabled() {
    return db.prepare('SELECT * FROM monitors WHERE enabled = 1').all();
  }

  // 创建监控项
  static create(data) {
    const {
      name, type, target, interval, timeout, enabled, config,
      description, group_name, tags, user_id, max_retries
    } = data;

    const pushToken = type === 'push' ? (data.push_token || generatePushToken()) : null;

    const stmt = db.prepare(`
      INSERT INTO monitors (name, type, target, interval, timeout, enabled, config,
                            description, group_name, tags, user_id, max_retries, push_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const configStr = config ? JSON.stringify(config) : null;
    const tagsStr = Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null;

    const result = stmt.run(
      name, type, target,
      interval || 300, timeout || 30,
      enabled !== undefined ? enabled : 1,
      configStr,
      description || null,
      group_name || null,
      tagsStr,
      user_id || null,
      max_retries || 1,
      pushToken
    );

    if (Array.isArray(data.channel_ids) && data.channel_ids.length > 0) {
      this.setChannels(result.lastInsertRowid, data.channel_ids);
    }

    return this.getById(result.lastInsertRowid);
  }

  // 更新监控项
  static update(id, data) {
    const existing = this.getById(id);
    if (!existing) return null;

    const merged = {
      name: data.name ?? existing.name,
      type: data.type ?? existing.type,
      target: data.target ?? existing.target,
      interval: data.interval ?? existing.interval,
      timeout: data.timeout ?? existing.timeout,
      enabled: data.enabled ?? existing.enabled,
      config: data.config !== undefined
        ? (data.config ? JSON.stringify(data.config) : null)
        : existing.config,
      description: data.description !== undefined ? data.description : existing.description,
      group_name: data.group_name !== undefined ? data.group_name : existing.group_name,
      tags: data.tags !== undefined
        ? (Array.isArray(data.tags) && data.tags.length > 0 ? JSON.stringify(data.tags) : null)
        : existing.tags,
      max_retries: data.max_retries ?? existing.max_retries,
      push_token: existing.push_token
    };

    // 类型改为 push 且还没有 token 时补发
    if (merged.type === 'push' && !merged.push_token) {
      merged.push_token = generatePushToken();
    }
    if (merged.type !== 'push') {
      merged.push_token = null;
    }

    db.prepare(`
      UPDATE monitors
      SET name = ?, type = ?, target = ?, interval = ?, timeout = ?, enabled = ?, config = ?,
          description = ?, group_name = ?, tags = ?, max_retries = ?, push_token = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      merged.name, merged.type, merged.target, merged.interval, merged.timeout,
      merged.enabled, merged.config, merged.description, merged.group_name,
      merged.tags, merged.max_retries, merged.push_token, id
    );

    if (data.channel_ids !== undefined) {
      this.setChannels(id, data.channel_ids);
    }

    return this.getById(id);
  }

  // 设置监控项关联的通知渠道
  static setChannels(monitorId, channelIds) {
    db.prepare('DELETE FROM monitor_channels WHERE monitor_id = ?').run(monitorId);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO monitor_channels (monitor_id, channel_id) VALUES (?, ?)'
    );
    for (const channelId of channelIds) {
      insert.run(monitorId, channelId);
    }
  }

  // 切换启用/禁用状态
  static toggle(id) {
    const monitor = this.getById(id);
    if (!monitor) return null;

    db.prepare(
      "UPDATE monitors SET enabled = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(monitor.enabled ? 0 : 1, id);

    return this.getById(id);
  }

  // 删除监控项
  static delete(id) {
    const result = db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // 记录检测结果
  static recordCheckResult(monitorId, result) {
    const { status, responseTime, statusCode, errorMessage, extra } = result;
    return db.prepare(`
      INSERT INTO check_results (monitor_id, status, response_time, status_code, error_message, extra, checked_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      monitorId, status,
      responseTime || null,
      statusCode || null,
      errorMessage || null,
      extra ? JSON.stringify(extra) : null
    );
  }

  // 获取检测历史
  static getCheckResults(monitorId, limit = 100) {
    return db.prepare(`
      SELECT * FROM check_results
      WHERE monitor_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(monitorId, limit);
  }

  // 获取最新检测结果
  static getLatestCheckResult(monitorId) {
    return db.prepare(`
      SELECT * FROM check_results
      WHERE monitor_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(monitorId);
  }

  // 创建故障事件
  static createIncident(monitorId, errorMessage = null) {
    const result = db.prepare(`
      INSERT INTO incidents (monitor_id, started_at, error_message)
      VALUES (?, datetime('now'), ?)
    `).run(monitorId, errorMessage);
    return result.lastInsertRowid;
  }

  static getIncidentById(id) {
    return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
  }

  // 结束故障事件
  static endIncident(monitorId) {
    return db.prepare(`
      UPDATE incidents
      SET ended_at = datetime('now'),
          duration = (julianday(datetime('now')) - julianday(started_at)) * 86400
      WHERE monitor_id = ? AND ended_at IS NULL
    `).run(monitorId);
  }

  // 获取当前进行中的故障
  static getActiveIncident(monitorId) {
    return db.prepare(`
      SELECT * FROM incidents
      WHERE monitor_id = ? AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `).get(monitorId);
  }

  // 获取故障历史
  static getIncidents(monitorId, limit = 50) {
    return db.prepare(`
      SELECT * FROM incidents
      WHERE monitor_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `).all(monitorId, limit);
  }

  // 获取各监控项的活跃故障（一次查询）
  static getActiveIncidentMap() {
    const rows = db.prepare(
      'SELECT id, monitor_id, started_at, error_message FROM incidents WHERE ended_at IS NULL'
    ).all();
    const map = {};
    for (const row of rows) {
      map[row.monitor_id] = row;
    }
    return map;
  }
}

export default MonitorModel;

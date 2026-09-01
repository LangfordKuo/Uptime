import db from './database.js';

class NotificationChannelModel {
  static getAll() {
    return db.prepare(`
      SELECT c.*,
        (SELECT GROUP_CONCAT(mc.monitor_id) FROM monitor_channels mc WHERE mc.channel_id = c.id) as monitor_ids
      FROM notification_channels c
      ORDER BY c.created_at DESC
    `).all();
  }

  static getById(id) {
    return db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(id);
  }

  static create(data) {
    const result = db.prepare(`
      INSERT INTO notification_channels (name, type, config, enabled)
      VALUES (?, ?, ?, ?)
    `).run(data.name, data.type, JSON.stringify(data.config || {}), data.enabled === false ? 0 : 1);
    return this.getById(result.lastInsertRowid);
  }

  static update(id, data) {
    const existing = this.getById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE notification_channels
      SET name = ?, type = ?, config = ?, enabled = ?
      WHERE id = ?
    `).run(
      data.name ?? existing.name,
      data.type ?? existing.type,
      data.config !== undefined ? JSON.stringify(data.config) : existing.config,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : existing.enabled,
      id
    );
    return this.getById(id);
  }

  static delete(id) {
    const result = db.prepare('DELETE FROM notification_channels WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // 渠道关联的监控项
  static getMonitorIds(channelId) {
    return db.prepare(
      'SELECT monitor_id FROM monitor_channels WHERE channel_id = ?'
    ).all(channelId).map(r => r.monitor_id);
  }

  static setMonitors(channelId, monitorIds) {
    db.prepare('DELETE FROM monitor_channels WHERE channel_id = ?').run(channelId);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO monitor_channels (monitor_id, channel_id) VALUES (?, ?)'
    );
    for (const monitorId of monitorIds) {
      insert.run(monitorId, channelId);
    }
  }

  static decorate(channel) {
    return {
      ...channel,
      config: (() => {
        try {
          const cfg = JSON.parse(channel.config || '{}');
          return maskSecrets(cfg);
        } catch {
          return {};
        }
      })(),
      monitor_ids: channel.monitor_ids
        ? channel.monitor_ids.split(',').map(Number)
        : []
    };
  }
}

// 列表接口脱敏：不回传完整密钥
function maskSecrets(cfg) {
  const masked = { ...cfg };
  const secretKeys = ['smtpPass', 'botToken', 'secret'];
  for (const key of secretKeys) {
    if (masked[key]) {
      masked[key] = '******';
      masked[`${key}__masked`] = true;
    }
  }
  return masked;
}

export default NotificationChannelModel;

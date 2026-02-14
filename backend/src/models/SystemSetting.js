import db from './database.js';

class SystemSettingModel {
  // 获取所有设置
  static getAll() {
    const stmt = db.prepare('SELECT key, value FROM system_settings');
    const rows = stmt.all();
    const settings = {};
    rows.forEach(row => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });
    return settings;
  }

  // 获取单个设置
  static get(key, defaultValue = null) {
    const stmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
    const row = stmt.get(key);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  // 设置值
  static set(key, value) {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const stmt = db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(key, valueStr);
  }

  // 批量设置
  static setMultiple(settings) {
    const results = [];
    for (const [key, value] of Object.entries(settings)) {
      results.push(this.set(key, value));
    }
    return results;
  }

  // 删除设置
  static delete(key) {
    const stmt = db.prepare('DELETE FROM system_settings WHERE key = ?');
    return stmt.run(key);
  }

  // 获取网站设置
  static getSiteSettings() {
    return {
      siteName: this.get('site_name', 'Uptime'),
      siteUrl: this.get('site_url', ''),
      siteDescription: this.get('site_description', '服务状态监控系统')
    };
  }

  // 保存网站设置
  static saveSiteSettings(settings) {
    if (settings.siteName !== undefined) {
      this.set('site_name', settings.siteName);
    }
    if (settings.siteUrl !== undefined) {
      this.set('site_url', settings.siteUrl);
    }
    if (settings.siteDescription !== undefined) {
      this.set('site_description', settings.siteDescription);
    }
    return this.getSiteSettings();
  }

  // 获取时区设置
  static getTimezoneSettings() {
    return {
      timezone: this.get('timezone', 'UTC'),
      dateFormat: this.get('date_format', 'YYYY-MM-DD HH:mm:ss')
    };
  }

  // 保存时区设置
  static saveTimezoneSettings(settings) {
    if (settings.timezone !== undefined) {
      this.set('timezone', settings.timezone);
    }
    if (settings.dateFormat !== undefined) {
      this.set('date_format', settings.dateFormat);
    }
    return this.getTimezoneSettings();
  }
}

export default SystemSettingModel;

import bcrypt from 'bcryptjs';
import db from './database.js';
import SystemSettingModel from './SystemSetting.js';
import StatisticsService from '../services/statisticsService.js';

class StatusPageModel {
  // 获取所有状态页
  static getAll() {
    const stmt = db.prepare(`
      SELECT sp.*, u.username as creator_name,
        (SELECT COUNT(*) FROM status_page_monitors WHERE status_page_id = sp.id) as monitor_count
      FROM status_pages sp
      LEFT JOIN users u ON sp.created_by = u.id
      ORDER BY sp.created_at DESC
    `);
    return stmt.all();
  }

  // 根据ID获取状态页
  static getById(id) {
    const stmt = db.prepare(`
      SELECT sp.*, u.username as creator_name
      FROM status_pages sp
      LEFT JOIN users u ON sp.created_by = u.id
      WHERE sp.id = ?
    `);
    return stmt.get(id);
  }

  // 根据 slug 获取状态页（用于公开访问，包含密码信息判断）
  static getBySlug(slug) {
    const stmt = db.prepare(`
      SELECT sp.*, u.username as creator_name
      FROM status_pages sp
      LEFT JOIN users u ON sp.created_by = u.id
      WHERE sp.slug = ? AND sp.is_public = 1
    `);
    return stmt.get(slug);
  }

  // 创建状态页
  static create(data) {
    const { name, slug, description, logo_url, password, is_public, created_by, monitor_ids } = data;

    const stmt = db.prepare(`
      INSERT INTO status_pages (name, slug, description, logo_url, password_hash, is_public, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name, slug,
      description || null, logo_url || null,
      password ? bcrypt.hashSync(password, 10) : null,
      is_public ? 1 : 0,
      created_by
    );
    const statusPageId = result.lastInsertRowid;

    if (monitor_ids && monitor_ids.length > 0) {
      this.updateMonitors(statusPageId, monitor_ids);
    }

    return this.getById(statusPageId);
  }

  // 更新状态页
  static update(id, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      fields.push('slug = ?');
      values.push(data.slug);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.logo_url !== undefined) {
      fields.push('logo_url = ?');
      values.push(data.logo_url);
    }
    if (data.is_public !== undefined) {
      fields.push('is_public = ?');
      values.push(data.is_public ? 1 : 0);
    }
    // 密码：传空字符串表示移除密码，传值表示设置/修改
    if (data.password !== undefined) {
      fields.push('password_hash = ?');
      values.push(data.password ? bcrypt.hashSync(data.password, 10) : null);
    }

    fields.push('updated_at = datetime(\'now\')');
    values.push(id);

    db.prepare(`
      UPDATE status_pages
      SET ${fields.join(', ')}
      WHERE id = ?
    `).run(...values);

    if (data.monitor_ids !== undefined) {
      this.updateMonitors(id, data.monitor_ids);
    }

    return this.getById(id);
  }

  // 校验状态页密码
  static verifyPassword(statusPage, password) {
    if (!statusPage.password_hash) return true;
    if (!password) return false;
    return bcrypt.compareSync(password, statusPage.password_hash);
  }

  // 删除状态页
  static delete(id) {
    const result = db.prepare('DELETE FROM status_pages WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // 更新状态页关联的监控项
  static updateMonitors(statusPageId, monitorIds) {
    db.prepare('DELETE FROM status_page_monitors WHERE status_page_id = ?').run(statusPageId);

    if (monitorIds && monitorIds.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO status_page_monitors (status_page_id, monitor_id, display_order)
        VALUES (?, ?, ?)
      `);
      monitorIds.forEach((monitorId, index) => {
        insertStmt.run(statusPageId, monitorId, index);
      });
    }
  }

  // 获取状态页关联的监控项（含最新状态与 30 天每日可用率，聚合查询）
  static getMonitors(statusPageId, days = 30) {
    const monitors = db.prepare(`
      SELECT
        m.id,
        m.name,
        m.type,
        m.target,
        m.enabled,
        spm.display_name,
        spm.display_order,
        cr.status as latest_status,
        cr.response_time as latest_response_time,
        cr.checked_at as latest_check
      FROM status_page_monitors spm
      JOIN monitors m ON spm.monitor_id = m.id
      LEFT JOIN check_results cr ON cr.id = (
        SELECT id FROM check_results WHERE monitor_id = m.id ORDER BY id DESC LIMIT 1
      )
      WHERE spm.status_page_id = ?
      ORDER BY spm.display_order ASC
    `).all(statusPageId);

    if (monitors.length === 0) return [];

    const timezone = SystemSettingModel.getTimezoneSettings().timezone || 'UTC';
    const dailyMap = StatisticsService.getDailyUptimeMap(
      monitors.map(m => m.id),
      days,
      timezone
    );

    return monitors.map(monitor => {
      const byDate = dailyMap[monitor.id] || {};

      // 补全连续 days 天的日期序列
      const dailyUptime = [];
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const stat = byDate[dateStr];
        dailyUptime.push({
          date: dateStr,
          uptime: stat && stat.total > 0
            ? Math.round((stat.up / stat.total) * 10000) / 100
            : null,
          total_checks: stat?.total || 0,
          up_count: stat?.up || 0
        });
      }

      return { ...monitor, daily_uptime: dailyUptime };
    });
  }

  // 获取状态页关联监控项的最近故障事件（含进行中的）
  static getRecentIncidents(statusPageId, limit = 10) {
    return db.prepare(`
      SELECT i.id, i.monitor_id, m.name as monitor_name,
             i.started_at, i.ended_at, i.duration, i.error_message
      FROM incidents i
      INNER JOIN status_page_monitors spm ON spm.monitor_id = i.monitor_id
      INNER JOIN monitors m ON m.id = i.monitor_id
      WHERE spm.status_page_id = ?
      ORDER BY i.started_at DESC
      LIMIT ?
    `).all(statusPageId, limit);
  }

  // 检查 slug 是否已存在
  static slugExists(slug, excludeId = null) {
    let sql = 'SELECT COUNT(*) as count FROM status_pages WHERE slug = ?';
    let params = [slug];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const result = db.prepare(sql).get(...params);
    return result.count > 0;
  }
}

export default StatusPageModel;

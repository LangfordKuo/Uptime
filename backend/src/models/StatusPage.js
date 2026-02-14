import db from './database.js';

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

  // 根据 slug 获取状态页（用于公开访问）
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
    const { name, slug, description, logo_url, is_public, created_by, monitor_ids } = data;
    
    const stmt = db.prepare(`
      INSERT INTO status_pages (name, slug, description, logo_url, is_public, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, slug, description || null, logo_url || null, is_public ? 1 : 0, created_by);
    const statusPageId = result.lastInsertRowid;
    
    // 添加关联的监控项
    if (monitor_ids && monitor_ids.length > 0) {
      this.updateMonitors(statusPageId, monitor_ids);
    }
    
    return this.getById(statusPageId);
  }

  // 更新状态页
  static update(id, data) {
    const { name, slug, description, logo_url, is_public, monitor_ids } = data;
    
    const fields = [];
    const values = [];
    
    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (slug !== undefined) {
      fields.push('slug = ?');
      values.push(slug);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description);
    }
    if (logo_url !== undefined) {
      fields.push('logo_url = ?');
      values.push(logo_url);
    }
    if (is_public !== undefined) {
      fields.push('is_public = ?');
      values.push(is_public ? 1 : 0);
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`
      UPDATE status_pages 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(...values);
    
    // 更新关联的监控项
    if (monitor_ids !== undefined) {
      this.updateMonitors(id, monitor_ids);
    }
    
    return this.getById(id);
  }

  // 删除状态页
  static delete(id) {
    const stmt = db.prepare('DELETE FROM status_pages WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // 更新状态页关联的监控项
  static updateMonitors(statusPageId, monitorIds) {
    // 删除旧的关联
    const deleteStmt = db.prepare('DELETE FROM status_page_monitors WHERE status_page_id = ?');
    deleteStmt.run(statusPageId);
    
    // 添加新的关联
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

  // 获取状态页关联的监控项
  static getMonitors(statusPageId) {
    const stmt = db.prepare(`
      SELECT 
        m.id,
        m.name,
        m.type,
        m.target,
        m.enabled,
        spm.display_name,
        spm.display_order,
        (SELECT status FROM check_results WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as latest_status,
        (SELECT response_time FROM check_results WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as latest_response_time,
        (SELECT checked_at FROM check_results WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as latest_check
      FROM status_page_monitors spm
      JOIN monitors m ON spm.monitor_id = m.id
      WHERE spm.status_page_id = ?
      ORDER BY spm.display_order ASC
    `);
    const monitors = stmt.all(statusPageId);
    
    // 为每个监控项获取30天的在线率数据
    return monitors.map(monitor => {
      const dailyUptime = this.getMonitorDailyUptime(monitor.id, 30);
      return {
        ...monitor,
        daily_uptime: dailyUptime
      };
    });
  }

  // 获取监控项最近N天的每日在线率
  static getMonitorDailyUptime(monitorId, days = 30) {
    const result = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // 获取该日期的检测记录
      const stmt = db.prepare(`
        SELECT 
          COUNT(*) as total_checks,
          SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
        FROM check_results
        WHERE monitor_id = ?
          AND date(checked_at) = ?
      `);
      
      const data = stmt.get(monitorId, dateStr);
      
      if (data.total_checks > 0) {
        const uptime = (data.up_count / data.total_checks) * 100;
        result.push({
          date: dateStr,
          uptime: Math.round(uptime * 100) / 100,
          total_checks: data.total_checks,
          up_count: data.up_count
        });
      } else {
        result.push({
          date: dateStr,
          uptime: null,
          total_checks: 0,
          up_count: 0
        });
      }
    }
    
    return result;
  }

  // 检查 slug 是否已存在
  static slugExists(slug, excludeId = null) {
    let sql = 'SELECT COUNT(*) as count FROM status_pages WHERE slug = ?';
    let params = [slug];
    
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    
    const stmt = db.prepare(sql);
    const result = stmt.get(...params);
    return result.count > 0;
  }
}

export default StatusPageModel;

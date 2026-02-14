import db from '../models/database.js';

class StatisticsService {
  // 计算指定时间范围内的可用率
  static calculateUptime(monitorId, hours = 24) {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
      FROM check_results
      WHERE monitor_id = ? 
        AND checked_at >= datetime('now', '-' || ? || ' hours')
    `);
    
    const result = stmt.get(monitorId, hours);
    
    if (!result || result.total === 0) {
      return {
        percentage: 0,
        total: 0,
        upCount: 0,
        downCount: 0
      };
    }
    
    return {
      percentage: ((result.up_count / result.total) * 100).toFixed(2),
      total: result.total,
      upCount: result.up_count,
      downCount: result.total - result.up_count
    };
  }

  // 计算平均响应时间
  static calculateAverageResponseTime(monitorId, hours = 24) {
    const stmt = db.prepare(`
      SELECT AVG(response_time) as avg_response_time
      FROM check_results
      WHERE monitor_id = ? 
        AND checked_at >= datetime('now', '-' || ? || ' hours')
        AND status = 'up'
        AND response_time IS NOT NULL
    `);
    
    const result = stmt.get(monitorId, hours);
    return result && result.avg_response_time ? Math.round(result.avg_response_time) : 0;
  }

  // 获取响应时间趋势数据
  static getResponseTimeTrend(monitorId, hours = 24, interval = 1) {
    const stmt = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', checked_at) as time_slot,
        AVG(response_time) as avg_response_time,
        MIN(response_time) as min_response_time,
        MAX(response_time) as max_response_time
      FROM check_results
      WHERE monitor_id = ? 
        AND checked_at >= datetime('now', '-' || ? || ' hours')
        AND response_time IS NOT NULL
      GROUP BY time_slot
      ORDER BY time_slot ASC
    `);
    
    return stmt.all(monitorId, hours);
  }

  // 获取监控项统计汇总
  static getMonitorStats(monitorId) {
    const uptime24h = this.calculateUptime(monitorId, 24);
    const uptime7d = this.calculateUptime(monitorId, 24 * 7);
    const uptime30d = this.calculateUptime(monitorId, 24 * 30);
    const avgResponseTime = this.calculateAverageResponseTime(monitorId, 24);

    // 获取最近的故障数
    const incidentStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM incidents
      WHERE monitor_id = ? 
        AND started_at >= datetime('now', '-30 days')
    `);
    const incidents = incidentStmt.get(monitorId);

    return {
      uptime: {
        last24h: uptime24h,
        last7d: uptime7d,
        last30d: uptime30d
      },
      avgResponseTime,
      incidentCount: incidents?.count || 0
    };
  }

  // 获取仪表盘总览数据
  static getDashboardStats() {
    // 总监控项数
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM monitors');
    const total = totalStmt.get();

    // 启用的监控项数
    const enabledStmt = db.prepare('SELECT COUNT(*) as count FROM monitors WHERE enabled = 1');
    const enabled = enabledStmt.get();

    // 当前 UP 的监控项数（基于最新检测结果）
    const upStmt = db.prepare(`
      SELECT COUNT(DISTINCT m.id) as count
      FROM monitors m
      INNER JOIN check_results cr ON m.id = cr.monitor_id
      WHERE m.enabled = 1
        AND cr.id IN (
          SELECT MAX(id) 
          FROM check_results 
          GROUP BY monitor_id
        )
        AND cr.status = 'up'
    `);
    const up = upStmt.get();

    // 当前活动的故障数
    const activeIncidentsStmt = db.prepare(`
      SELECT COUNT(*) as count FROM incidents WHERE ended_at IS NULL
    `);
    const activeIncidents = activeIncidentsStmt.get();

    return {
      total: total?.count || 0,
      enabled: enabled?.count || 0,
      up: up?.count || 0,
      down: (enabled?.count || 0) - (up?.count || 0),
      activeIncidents: activeIncidents?.count || 0
    };
  }

  // 清理旧数据
  static cleanupOldData(days = 30) {
    const deletedCount = db.prepare(`
      DELETE FROM check_results 
      WHERE checked_at < datetime('now', '-' || ? || ' days')
    `).run(days);

    console.log(`Cleaned up ${deletedCount.changes} old check results`);
    return deletedCount.changes;
  }
}

export default StatisticsService;

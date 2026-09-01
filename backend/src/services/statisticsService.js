import db from '../models/database.js';
import config from '../config/config.js';

class StatisticsService {
  // 原始数据的保留边界（小时），更早的数据在每日维护时聚合进小时表
  static get rawRetentionHours() {
    return config.rawRetentionHours;
  }

  // 计算指定时间范围内的可用率。
  // 短周期直接查原始记录；长周期合并"小时聚合表 + 近期原始记录"。
  static calculateUptime(monitorId, hours = 24) {
    const rows = hours <= this.rawRetentionHours
      ? db.prepare(`
          SELECT COUNT(*) as total,
                 SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
          FROM check_results
          WHERE monitor_id = ?
            AND checked_at >= datetime('now', '-' || ? || ' hours')
        `).all(monitorId, hours)
      : db.prepare(`
          SELECT SUM(total) as total, SUM(up_count) as up_count FROM (
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
            FROM check_results
            WHERE monitor_id = ?
              AND checked_at >= datetime('now', '-' || ? || ' hours')
            UNION ALL
            SELECT total, up_count
            FROM check_results_hourly
            WHERE monitor_id = ?
              AND hour_slot >= strftime('%Y-%m-%d %H:00:00', 'now', '-' || ? || ' hours')
              AND hour_slot < strftime('%Y-%m-%d %H:00:00', 'now', '-' || ? || ' hours')
          )
        `).all(monitorId, hours, monitorId, hours, this.rawRetentionHours);

    const result = rows[0];

    if (!result || !result.total) {
      return { percentage: 0, total: 0, upCount: 0, downCount: 0 };
    }

    return {
      percentage: +((result.up_count / result.total) * 100).toFixed(2),
      total: result.total,
      upCount: result.up_count,
      downCount: result.total - result.up_count
    };
  }

  // 计算平均响应时间（同上，区分长短周期）
  static calculateAverageResponseTime(monitorId, hours = 24) {
    const rows = hours <= this.rawRetentionHours
      ? db.prepare(`
          SELECT AVG(response_time) as avg_response_time
          FROM check_results
          WHERE monitor_id = ?
            AND checked_at >= datetime('now', '-' || ? || ' hours')
            AND status = 'up'
            AND response_time IS NOT NULL
        `).all(monitorId, hours)
      : db.prepare(`
          SELECT SUM(sum_response) as sum_response, SUM(cnt) as cnt FROM (
            SELECT COALESCE(SUM(response_time), 0) as sum_response, COUNT(*) as cnt
            FROM check_results
            WHERE monitor_id = ?
              AND checked_at >= datetime('now', '-' || ? || ' hours')
              AND status = 'up'
              AND response_time IS NOT NULL
            UNION ALL
            SELECT sum_response, total
            FROM check_results_hourly
            WHERE monitor_id = ?
              AND hour_slot >= strftime('%Y-%m-%d %H:00:00', 'now', '-' || ? || ' hours')
              AND hour_slot < strftime('%Y-%m-%d %H:00:00', 'now', '-' || ? || ' hours')
              AND total > 0
          ) WHERE cnt > 0
        `).all(monitorId, hours, monitorId, hours, this.rawRetentionHours);

    const result = rows[0];
    if (!result || !result.cnt) return 0;
    return Math.round(result.sum_response / result.cnt);
  }

  // 获取响应时间趋势数据（小时级；长周期返回按天聚合）
  static getResponseTimeTrend(monitorId, hours = 24) {
    if (hours <= this.rawRetentionHours) {
      return db.prepare(`
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
      `).all(monitorId, hours);
    }

    return db.prepare(`
      SELECT
        substr(hour_slot, 1, 10) || ' 00:00:00' as time_slot,
        CASE WHEN SUM(total) > 0 THEN SUM(sum_response) / SUM(total) ELSE NULL END as avg_response_time,
        MIN(min_response) as min_response_time,
        MAX(max_response) as max_response_time
      FROM check_results_hourly
      WHERE monitor_id = ?
        AND hour_slot >= strftime('%Y-%m-%d %H:00:00', 'now', '-' || ? || ' hours')
        AND sum_response > 0
      GROUP BY substr(hour_slot, 1, 10)
      ORDER BY time_slot ASC
    `).all(monitorId, hours);
  }

  // 获取监控项统计汇总
  static getMonitorStats(monitorId) {
    const uptime24h = this.calculateUptime(monitorId, 24);
    const uptime7d = this.calculateUptime(monitorId, 24 * 7);
    const uptime30d = this.calculateUptime(monitorId, 24 * 30);
    const avgResponseTime = this.calculateAverageResponseTime(monitorId, 24);

    const incidents = db.prepare(`
      SELECT COUNT(*) as count
      FROM incidents
      WHERE monitor_id = ?
        AND started_at >= datetime('now', '-30 days')
    `).get(monitorId);

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

  // 批量计算所有监控项的 24h 可用率（一次 GROUP BY，避免 N+1）
  static getUptime24hMap() {
    const rows = db.prepare(`
      SELECT monitor_id,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
      FROM check_results
      WHERE checked_at >= datetime('now', '-24 hours')
      GROUP BY monitor_id
    `).all();

    const map = {};
    for (const row of rows) {
      map[row.monitor_id] = row.total > 0
        ? +((row.up_count / row.total) * 100).toFixed(2)
        : 0;
    }
    return map;
  }

  // 批量获取每个监控项当天（按系统时区）的可用率，用于状态页 30 天热力图
  static getDailyUptimeMap(monitorIds, days = 30, timezone = 'UTC') {
    const offsetHours = getTimezoneOffsetHours(timezone);
    const result = {};
    if (!monitorIds.length) return result;

    const placeholders = monitorIds.map(() => '?').join(',');

    // 小时聚合表（覆盖较老的数据）
    const hourlyRows = db.prepare(`
      SELECT monitor_id, hour_slot, total, up_count
      FROM check_results_hourly
      WHERE monitor_id IN (${placeholders})
        AND hour_slot >= strftime('%Y-%m-%d %H:00:00', 'now', '-' || ? || ' days')
    `).all(...monitorIds, days);

    // 近期原始记录（聚合表还没覆盖的部分）
    const rawRows = db.prepare(`
      SELECT monitor_id,
             strftime('%Y-%m-%d %H:00:00', checked_at) as hour_slot,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
      FROM check_results
      WHERE monitor_id IN (${placeholders})
        AND checked_at >= datetime('now', '-' || ? || ' days')
      GROUP BY monitor_id, hour_slot
    `).all(...monitorIds, days);

    // 合并（原始记录优先，包含聚合表尚未覆盖的最新小时）
    const merged = {};
    for (const row of [...hourlyRows, ...rawRows]) {
      const key = `${row.monitor_id}|${row.hour_slot}`;
      merged[key] = { monitorId: row.monitor_id, slot: row.hour_slot, total: row.total, up: row.up_count || 0 };
    }

    // 按"目标时区的日期"分组
    for (const { monitorId, slot, total, up } of Object.values(merged)) {
      // hour_slot 是 UTC 时间，加上时区偏移得到本地日期
      const utcMs = Date.parse(slot.replace(' ', 'T') + 'Z');
      const localDate = new Date(utcMs + offsetHours * 3600000).toISOString().slice(0, 10);

      if (!result[monitorId]) result[monitorId] = {};
      if (!result[monitorId][localDate]) result[monitorId][localDate] = { total: 0, up: 0 };
      result[monitorId][localDate].total += total;
      result[monitorId][localDate].up += up;
    }

    return result;
  }

  // 获取仪表盘总览数据
  static getDashboardStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM monitors').get();
    const enabled = db.prepare('SELECT COUNT(*) as count FROM monitors WHERE enabled = 1').get();

    // 基于"存在检测记录"的最新结果分类，从未检测过的单独算 unknown
    const latest = db.prepare(`
      SELECT m.id, cr.status
      FROM monitors m
      INNER JOIN check_results cr ON cr.id = (
        SELECT id FROM check_results WHERE monitor_id = m.id ORDER BY id DESC LIMIT 1
      )
      WHERE m.enabled = 1
    `).all();

    let up = 0, down = 0;
    for (const row of latest) {
      if (row.status === 'up') up++;
      else down++;
    }

    const activeIncidents = db.prepare(
      'SELECT COUNT(*) as count FROM incidents WHERE ended_at IS NULL'
    ).get();

    const enabledCount = enabled?.count || 0;
    const checkedCount = latest.length;

    return {
      total: total?.count || 0,
      enabled: enabledCount,
      up,
      down,
      unknown: enabledCount - checkedCount,
      activeIncidents: activeIncidents?.count || 0
    };
  }

  // 数据降采样：把超过保留期的原始记录聚合进小时表后删除
  static aggregateRawData() {
    const cutoff = `-${this.rawRetentionHours} hours`;
    const hourCutoff = strftimeNow(cutoff);

    const upserted = db.prepare(`
      INSERT INTO check_results_hourly
        (monitor_id, hour_slot, total, up_count, sum_response, min_response, max_response)
      SELECT monitor_id,
             strftime('%Y-%m-%d %H:00:00', checked_at) as hour_slot,
             COUNT(*),
             SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END),
             COALESCE(SUM(response_time), 0),
             MIN(response_time),
             MAX(response_time)
      FROM check_results
      WHERE strftime('%Y-%m-%d %H:00:00', checked_at) < ?
        AND checked_at >= datetime('now', '-400 days')
      GROUP BY monitor_id, hour_slot
      ON CONFLICT(monitor_id, hour_slot) DO UPDATE SET
        total = total + excluded.total,
        up_count = up_count + excluded.up_count,
        sum_response = sum_response + excluded.sum_response,
        min_response = CASE
          WHEN min_response IS NULL THEN excluded.min_response
          WHEN excluded.min_response IS NULL THEN min_response
          ELSE MIN(min_response, excluded.min_response) END,
        max_response = CASE
          WHEN max_response IS NULL THEN excluded.max_response
          WHEN excluded.max_response IS NULL THEN max_response
          ELSE MAX(max_response, excluded.max_response) END
    `).run(hourCutoff);

    // 只删除已完整聚合的小时（与上面相同的条件）
    const deleted = db.prepare(`
      DELETE FROM check_results
      WHERE strftime('%Y-%m-%d %H:00:00', checked_at) < ?
    `).run(hourCutoff);

    if (deleted.changes > 0) {
      console.log(`Aggregated ${upserted.changes} hour slots, removed ${deleted.changes} raw check results`);
    }
    return deleted.changes;
  }

  // 清理过期的聚合数据
  static cleanupOldData(days = config.dataRetentionDays) {
    const deletedRaw = db.prepare(`
      DELETE FROM check_results
      WHERE checked_at < datetime('now', '-' || ? || ' days')
    `).run(days);

    const deletedHourly = db.prepare(`
      DELETE FROM check_results_hourly
      WHERE hour_slot < strftime('%Y-%m-%d %H:00:00', 'now', '-' || ? || ' days')
    `).run(days);

    // 顺带清理已经结束很久的故障事件（保留 180 天）
    const deletedIncidents = db.prepare(`
      DELETE FROM incidents
      WHERE ended_at IS NOT NULL AND ended_at < datetime('now', '-180 days')
    `).run();

    if (deletedRaw.changes + deletedHourly.changes > 0) {
      console.log(`Cleanup: ${deletedRaw.changes} raw, ${deletedHourly.changes} hourly, ${deletedIncidents.changes} old incidents removed`);
    }
    return deletedRaw.changes + deletedHourly.changes;
  }

  // 每日维护任务：先聚合再清理
  static runDailyMaintenance() {
    try {
      this.aggregateRawData();
      this.cleanupOldData();
    } catch (error) {
      console.error('Daily maintenance failed:', error);
    }
  }
}

// strftime('%Y-%m-%d %H:00:00', 'now', modifier) 的等价实现，
// 用于在 JS 中计算截断时间，保证 SQL 条件两侧一致
function strftimeNow(modifier) {
  const d = new Date(Date.now() - parseModifierHours(modifier) * 3600000);
  // SQLite 的 datetime 字符串用空格分隔，不是 ISO 的 T
  return d.toISOString().slice(0, 13).replace('T', ' ') + ':00:00';
}

function parseModifierHours(modifier) {
  const match = String(modifier).match(/-?\s*(\d+)\s*(hour|day|minute)s?/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  if (match[2] === 'day') return value * 24;
  if (match[2] === 'minute') return value / 60;
  return value;
}

// 计算目标时区与 UTC 的小时偏移（支持夏令时）
function getTimezoneOffsetHours(tz) {
  if (!tz || tz === 'UTC') return 0;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(now).map(p => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    parts.year, parts.month - 1, parts.day,
    parts.hour % 24, parts.minute, parts.second
  );

  return (asUTC - now.getTime()) / 3600000;
}

export default StatisticsService;

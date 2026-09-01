import express from 'express';
import MonitorModel from '../models/Monitor.js';
import StatisticsService from '../services/statisticsService.js';
import config from '../config/config.js';

// Prometheus 文本格式指标端点
const router = express.Router();

function escapeLabel(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

router.get('/metrics', (req, res) => {
  if (!config.metricsEnabled) {
    return res.status(404).json({ success: false, message: 'Metrics disabled' });
  }

  try {
    const monitors = MonitorModel.getAll();
    const uptimeMap = StatisticsService.getUptime24hMap();

    const lines = [
      '# HELP uptime_monitor_status Monitor status (1 = up, 0 = down, -1 = unknown/paused)',
      '# TYPE uptime_monitor_status gauge',
      '# HELP uptime_monitor_response_time_milliseconds Latest check response time',
      '# TYPE uptime_monitor_response_time_milliseconds gauge',
      '# HELP uptime_monitor_uptime_ratio_24h Uptime ratio over the last 24 hours (0-1)',
      '# TYPE uptime_monitor_uptime_ratio_24h gauge'
    ];

    for (const m of monitors) {
      const labels = `monitor_id="${m.id}",monitor_name="${escapeLabel(m.name)}",monitor_type="${m.type}"`;
      const statusValue = m.enabled ? (m.latest_status === 'up' ? 1 : m.latest_status === 'down' ? 0 : -1) : -1;
      lines.push(`uptime_monitor_status{${labels}} ${statusValue}`);

      if (m.latest_response_time != null) {
        lines.push(`uptime_monitor_response_time_milliseconds{${labels}} ${m.latest_response_time}`);
      }

      const uptime = uptimeMap[m.id];
      if (uptime != null) {
        lines.push(`uptime_monitor_uptime_ratio_24h{${labels}} ${(uptime / 100).toFixed(4)}`);
      }
    }

    lines.push('');
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(lines.join('\n'));
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).send('# metrics error\n');
  }
});

export default router;

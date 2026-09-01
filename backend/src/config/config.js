export default {
  port: process.env.PORT || 3000,
  // 支持逗号分隔的多个来源，'*' 表示允许任意来源
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  // 原始检测记录保留时长（小时），更早的数据会聚合到小时表
  rawRetentionHours: parseInt(process.env.RAW_RETENTION_HOURS) || 48,
  // 聚合数据保留天数
  dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS) || 365,
  cleanupInterval: process.env.CLEANUP_INTERVAL || '30 2 * * *', // 每天凌晨2点半
  // 自动备份
  backupEnabled: process.env.BACKUP_ENABLED !== 'false',
  backupInterval: process.env.BACKUP_INTERVAL || '0 4 * * *', // 每天凌晨4点
  backupKeep: parseInt(process.env.BACKUP_KEEP) || 7,
  // Prometheus 指标端点（设为 'false' 关闭）
  metricsEnabled: process.env.METRICS_ENABLED !== 'false',
};

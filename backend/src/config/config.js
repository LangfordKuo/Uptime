export default {
  port: process.env.PORT || 3000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS) || 30,
  cleanupInterval: process.env.CLEANUP_INTERVAL || '0 2 * * *', // 每天凌晨2点
};

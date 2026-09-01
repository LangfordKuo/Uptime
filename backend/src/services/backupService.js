import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/config.js';
import { backupDatabase, dbPath } from '../models/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库自动备份服务
class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.cronTask = null;
  }

  initialize() {
    fs.mkdirSync(this.backupDir, { recursive: true });

    if (!config.backupEnabled) {
      console.log('Auto backup disabled');
      return;
    }

    try {
      this.cronTask = cron.schedule(config.backupInterval, () => {
        this.createBackup('auto').catch(err =>
          console.error('Auto backup failed:', err)
        );
      });
      console.log(`Auto backup scheduled: ${config.backupInterval}, keeping ${config.backupKeep} backups`);
    } catch (error) {
      console.error('Failed to schedule backup:', error);
    }
  }

  // 创建备份，返回备份文件名
  async createBackup(tag = 'manual') {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const filename = `uptime-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${tag}.db`;
    const dest = path.join(this.backupDir, filename);

    await backupDatabase(dest);
    console.log(`Backup created: ${filename}`);

    this.pruneOldBackups();
    return filename;
  }

  // 只保留最近 N 份
  pruneOldBackups() {
    const files = this.listBackups();
    const toDelete = files.slice(config.backupKeep);
    for (const file of toDelete) {
      try {
        fs.unlinkSync(path.join(this.backupDir, file.name));
      } catch (err) {
        console.error(`Failed to delete old backup ${file.name}:`, err.message);
      }
    }
  }

  // 备份列表（新的在前）
  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs.readdirSync(this.backupDir)
      .filter(f => f.endsWith('.db'))
      .map(name => {
        const stat = fs.statSync(path.join(this.backupDir, name));
        return { name, size: stat.size, created_at: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // 读取备份文件内容（用于下载），防路径穿越
  getBackupStream(name) {
    const safe = path.basename(name);
    if (!safe.endsWith('.db')) return null;
    const full = path.join(this.backupDir, safe);
    if (!fs.existsSync(full)) return null;
    return fs.createReadStream(full);
  }

  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
  }
}

export default BackupService;
export { dbPath };

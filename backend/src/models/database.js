import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径（可通过环境变量覆盖，测试时使用内存数据库）
export const dbPath = process.env.UPTIME_DB_PATH || path.join(__dirname, '../database/uptime.db');

let db = null;

// better-sqlite3 拒绝 undefined 参数，统一转为 null
function normalizeParams(params) {
  return params.map(p => (p === undefined ? null : p));
}

// 包装 prepare，保持与旧 sql.js 版本一致的 run/get/all 接口
const dbWrapper = {
  prepare: (sql) => {
    if (!db) {
      throw new Error('DATABASE_NOT_INITIALIZED');
    }
    const stmt = db.prepare(sql);
    return {
      run: (...params) => stmt.run(...normalizeParams(params)),
      get: (...params) => stmt.get(...normalizeParams(params)),
      all: (...params) => stmt.all(...normalizeParams(params))
    };
  },
  exec: (sql) => {
    if (!db) {
      throw new Error('DATABASE_NOT_INITIALIZED');
    }
    db.exec(sql);
  },
  pragma: (pragma) => {
    db.pragma(pragma);
  },
  // 事务辅助（better-sqlite3 原生事务，性能远高于逐条执行）
  transaction: (fn) => db.transaction(fn),
  get raw() {
    return db;
  }
};

export function isInstalled() {
  // 判断标准：users 表中存在账户。
  // 不能再用"数据库文件存在"判断——应用启动时就会创建并迁移空库。
  if (!db) return false;
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
    return row.count > 0;
  } catch {
    return false;
  }
}

function tableColumns(tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().map(r => r.name);
}

function addColumnIfMissing(table, column, ddl) {
  if (!tableColumns(table).includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

// 全新的 monitors 表结构（包含所有新字段与新监控类型）
const MONITORS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS monitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('http', 'tcp', 'ping', 'push', 'ssl', 'domain', 'dns', 'docker')),
    target TEXT NOT NULL,
    interval INTEGER DEFAULT 300,
    timeout INTEGER DEFAULT 30,
    enabled INTEGER DEFAULT 1,
    config TEXT,
    description TEXT,
    group_name TEXT,
    tags TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    max_retries INTEGER DEFAULT 1,
    push_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

// 旧版本的 monitors 表 CHECK 约束只有 http/tcp/ping，
// SQLite 无法修改 CHECK 约束，需要重建表
function upgradeMonitorsTable() {
  const row = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'monitors'"
  ).get();

  if (!row) {
    // 表不存在，直接创建（users 表必须先存在，因为外键引用）
    dbWrapper.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user', 'viewer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    dbWrapper.exec(MONITORS_TABLE_SQL);
    return;
  }

  if (row.sql.includes("'push'")) {
    // 已经是新结构
    return;
  }

  console.log('Migrating monitors table to support new monitor types...');
  db.pragma('foreign_keys = OFF');
  const migrate = dbWrapper.transaction(() => {
    dbWrapper.exec(MONITORS_TABLE_SQL.replace('monitors', 'monitors_new'));
    dbWrapper.exec(`
      INSERT INTO monitors_new (id, name, type, target, interval, timeout, enabled, config,
                                created_at, updated_at)
      SELECT id, name, type, target, interval, timeout, enabled, config,
             created_at, updated_at FROM monitors
    `);
    dbWrapper.exec('DROP TABLE monitors');
    dbWrapper.exec('ALTER TABLE monitors_new RENAME TO monitors');
  });
  migrate();
  db.pragma('foreign_keys = ON');
  console.log('Monitors table migrated successfully');
}

const MIGRATIONS = [
  {
    id: '001_base_schema',
    up: () => {
      // 用户表
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user', 'viewer')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 监控表（含新类型检查约束；旧表会自动重建）
      upgradeMonitorsTable();

      // 旧库补充新列（新库建表时已包含，自动跳过）
      addColumnIfMissing('monitors', 'description', 'TEXT');
      addColumnIfMissing('monitors', 'group_name', 'TEXT');
      addColumnIfMissing('monitors', 'tags', 'TEXT');
      addColumnIfMissing('monitors', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
      addColumnIfMissing('monitors', 'max_retries', 'INTEGER DEFAULT 1');
      addColumnIfMissing('monitors', 'push_token', 'TEXT');

      // 检测结果表
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS check_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          monitor_id INTEGER NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('up', 'down')),
          response_time INTEGER,
          status_code INTEGER,
          error_message TEXT,
          extra TEXT,
          checked_at DATETIME DEFAULT (datetime('now')),
          FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
        )
      `);
      addColumnIfMissing('check_results', 'extra', 'TEXT');

      // 小时级聚合表（数据降采样：原始记录只保留近期，历史按小时聚合）
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS check_results_hourly (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          monitor_id INTEGER NOT NULL,
          hour_slot TEXT NOT NULL,
          total INTEGER NOT NULL DEFAULT 0,
          up_count INTEGER NOT NULL DEFAULT 0,
          sum_response REAL NOT NULL DEFAULT 0,
          min_response INTEGER,
          max_response INTEGER,
          UNIQUE(monitor_id, hour_slot),
          FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
        )
      `);

      // 故障事件表
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS incidents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          monitor_id INTEGER NOT NULL,
          started_at DATETIME NOT NULL,
          ended_at DATETIME,
          duration INTEGER,
          error_message TEXT,
          FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
        )
      `);
      addColumnIfMissing('incidents', 'error_message', 'TEXT');

      // 状态页表
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS status_pages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          logo_url TEXT,
          password_hash TEXT,
          is_public INTEGER DEFAULT 1,
          created_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      addColumnIfMissing('status_pages', 'password_hash', 'TEXT');

      // 状态页-监控关联表
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS status_page_monitors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          status_page_id INTEGER NOT NULL,
          monitor_id INTEGER NOT NULL,
          display_name TEXT,
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (status_page_id) REFERENCES status_pages(id) ON DELETE CASCADE,
          FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
          UNIQUE(status_page_id, monitor_id)
        )
      `);

      // 系统设置表
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 通知渠道表
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS notification_channels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('email', 'telegram', 'webhook', 'dingtalk', 'feishu', 'wecom')),
          config TEXT NOT NULL DEFAULT '{}',
          enabled INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 监控-通知渠道关联表
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS monitor_channels (
          monitor_id INTEGER NOT NULL,
          channel_id INTEGER NOT NULL,
          UNIQUE(monitor_id, channel_id),
          FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
          FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
        )
      `);

      // 维护窗口表（计划内停机）
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS maintenance_windows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          monitor_id INTEGER NOT NULL,
          name TEXT DEFAULT '',
          start_at TEXT NOT NULL,
          end_at TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
        )
      `);

      // API Key 表
      dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          key TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_used_at DATETIME
        )
      `);

      // 索引
      dbWrapper.exec(`
        CREATE INDEX IF NOT EXISTS idx_check_results_monitor_checked
        ON check_results(monitor_id, checked_at);
        CREATE INDEX IF NOT EXISTS idx_check_results_checked_at
        ON check_results(checked_at);
        CREATE INDEX IF NOT EXISTS idx_check_results_hourly_monitor
        ON check_results_hourly(monitor_id, hour_slot);
        CREATE INDEX IF NOT EXISTS idx_incidents_monitor_started
        ON incidents(monitor_id, started_at);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_monitors_push_token
        ON monitors(push_token) WHERE push_token IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_maintenance_monitor
        ON maintenance_windows(monitor_id, start_at, end_at);
      `);
    }
  }
];

function runMigrations() {
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = new Set(
    db.prepare('SELECT id FROM _migrations').all().map(r => r.id)
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    console.log(`Applying migration: ${migration.id}`);
    const run = dbWrapper.transaction(() => migration.up());
    run();
    db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(migration.id);
  }
}

// 打开数据库并执行迁移（新安装前调用时仅创建表结构，由安装流程写入管理员账户）
export function initializeDatabase() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const isNew = !fs.existsSync(dbPath);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  if (isNew) {
    console.log('Created new database file');
  } else {
    console.log('Opened existing database');
  }

  runMigrations();
  return { isNew };
}

// 备份数据库到指定路径（better-sqlite3 原生在线备份，WAL 安全）
export function backupDatabase(destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  return db.backup(destPath);
}

// 关闭数据库连接
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// 仅用于安装流程：确保数据库已打开（安装路由在未安装状态下也需要能创建表）
export function ensureDatabaseOpen() {
  if (!db) {
    initializeDatabase();
  }
}

export default dbWrapper;

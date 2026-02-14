import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../database/uptime.db');

let db = null;
let SQL = null;
let dbInitialized = false; // 标记数据库是否已完全初始化

// 初始化数据库连接
async function initDb() {
  SQL = await initSqlJs();
  
  try {
    // 尝试从文件加载数据库
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
      dbInitialized = true; // 从文件加载的数据库视为已初始化
      console.log('Loaded existing database from file');
    } else {
      // 如果文件不存在，暂时创建内存数据库但不保存
      db = new SQL.Database();
      dbInitialized = false; // 内存数据库未初始化
      console.log('Database file not found, created temporary in-memory database');
    }
  } catch (err) {
    console.error('Error loading database:', err);
    db = new SQL.Database();
    dbInitialized = false;
  }
  
  // 启用外键约束
  db.run('PRAGMA foreign_keys = ON');
}

// 保存数据库到文件
function saveDatabase() {
  // 只有在数据库已初始化后才保存
  if (db && dbInitialized) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// 定时保存数据库
setInterval(saveDatabase, 5000); // 每5秒保存一次

// 进程退出时保存
process.on('exit', saveDatabase);
process.on('SIGINT', () => {
  saveDatabase();
  process.exit(0);
});

// 包装执行方法
const dbWrapper = {
  prepare: (sql) => {
    return {
      run: (...params) => {
        try {
          db.run(sql, params);
          
          // 获取最后插入的行ID和修改的行数
          const result = db.exec('SELECT last_insert_rowid() as id');
          const lastId = result[0]?.values[0]?.[0];
          const changes = db.getRowsModified();
          
          // 在获取结果后再保存
          saveDatabase();
          
          return { 
            lastInsertRowid: lastId,
            changes: changes
          };
        } catch (err) {
          console.error('SQL Error:', err);
          throw err;
        }
      },
      get: (...params) => {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          
          if (stmt.step()) {
            const columns = stmt.getColumnNames();
            const row = {};
            columns.forEach((col, idx) => {
              row[col] = stmt.get()[idx];
            });
            stmt.free();
            return row;
          }
          
          stmt.free();
          return undefined;
        } catch (err) {
          console.error('SQL Error:', err);
          throw err;
        }
      },
      all: (...params) => {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          
          const results = [];
          const columns = stmt.getColumnNames();
          
          while (stmt.step()) {
            const row = {};
            const values = stmt.get();
            columns.forEach((col, idx) => {
              row[col] = values[idx];
            });
            results.push(row);
          }
          
          stmt.free();
          return results;
        } catch (err) {
          console.error('SQL Error:', err);
          throw err;
        }
      }
    };
  },
  exec: (sql) => {
    try {
      db.run(sql);
      saveDatabase();
    } catch (err) {
      console.error('SQL Error:', err);
      throw err;
    }
  },
  pragma: (pragma) => {
    db.run(`PRAGMA ${pragma}`);
  }
};

// 初始化数据库表
export async function initializeDatabase() {
  await initDb();
  
  // 如果数据库文件不存在，不创建表结构，等待安装流程
  if (!fs.existsSync(dbPath)) {
    console.log('Database file does not exist. Please run the installation first.');
    return;
  }
  
  console.log('Initializing database tables...');
  
  // 创建 monitors 表
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('http', 'tcp', 'ping')),
      target TEXT NOT NULL,
      interval INTEGER DEFAULT 300,
      timeout INTEGER DEFAULT 30,
      enabled INTEGER DEFAULT 1,
      config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建 check_results 表
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS check_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('up', 'down')),
      response_time INTEGER,
      status_code INTEGER,
      error_message TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    )
  `);

  // 创建 incidents 表
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      started_at DATETIME NOT NULL,
      ended_at DATETIME,
      duration INTEGER,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    )
  `);

  // 创建索引以优化查询
  dbWrapper.exec(`
    CREATE INDEX IF NOT EXISTS idx_check_results_monitor_id 
    ON check_results(monitor_id);
  `);

  dbWrapper.exec(`
    CREATE INDEX IF NOT EXISTS idx_check_results_checked_at 
    ON check_results(checked_at);
  `);

  dbWrapper.exec(`
    CREATE INDEX IF NOT EXISTS idx_incidents_monitor_id 
    ON incidents(monitor_id);
  `);

  // 创建 users 表
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

  // 创建 status_pages 表
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS status_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      logo_url TEXT,
      is_public INTEGER DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 创建 status_page_monitors 关联表
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

  // 创建系统设置表
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database tables initialized successfully');
}

// 创建数据库表结构（用于安装时调用）
export async function createDatabaseTables() {
  console.log('Creating database tables...');
  
  // 标记数据库已初始化，允许保存
  dbInitialized = true;
  
  // 创建 monitors 表
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('http', 'tcp', 'ping')),
      target TEXT NOT NULL,
      interval INTEGER DEFAULT 300,
      timeout INTEGER DEFAULT 30,
      enabled INTEGER DEFAULT 1,
      config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建 check_results 表
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS check_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('up', 'down')),
      response_time INTEGER,
      status_code INTEGER,
      error_message TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    )
  `);

  // 创建 incidents 表
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      started_at DATETIME NOT NULL,
      ended_at DATETIME,
      duration INTEGER,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    )
  `);

  // 创建索引以优化查询
  dbWrapper.exec(`
    CREATE INDEX IF NOT EXISTS idx_check_results_monitor_id 
    ON check_results(monitor_id);
  `);

  dbWrapper.exec(`
    CREATE INDEX IF NOT EXISTS idx_check_results_checked_at 
    ON check_results(checked_at);
  `);

  dbWrapper.exec(`
    CREATE INDEX IF NOT EXISTS idx_incidents_monitor_id 
    ON incidents(monitor_id);
  `);

  // 创建 users 表
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

  // 创建 status_pages 表
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS status_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      logo_url TEXT,
      is_public INTEGER DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 创建 status_page_monitors 关联表
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

  // 创建系统设置表
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 保存数据库到文件
  saveDatabase();
  
  console.log('Database tables created successfully');
}

export default dbWrapper;

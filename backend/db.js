import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data.sqlite');
export const db = new DatabaseSync(dbPath);

// Enable WAL for performance & concurrency
db.exec('PRAGMA journal_mode = WAL;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      fullname TEXT,
      bp_login TEXT,
      bp_password TEXT,
      nrp TEXT,
      dept TEXT,
      bp_cookies TEXT,
      bp_cookies_updated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS surat_tugas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      st_number TEXT NOT NULL,
      title TEXT NOT NULL,
      advance_money INTEGER DEFAULT 0,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      ess_form_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      st_id INTEGER NOT NULL,
      date DATE NOT NULL,
      wo_number TEXT,
      job_description TEXT,
      customer TEXT,
      upd_amount INTEGER DEFAULT 132500,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(st_id, date),
      FOREIGN KEY (st_id) REFERENCES surat_tugas(id)
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_number TEXT UNIQUE NOT NULL,
      customer TEXT,
      unit_model TEXT,
      serial_number TEXT,
      job_description TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      st_id INTEGER,
      daily_plan_id INTEGER,
      date DATE NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      keterangan TEXT,
      wo_number TEXT,
      receipt_path TEXT,
      is_shared_split INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (st_id) REFERENCES surat_tugas(id),
      FOREIGN KEY (daily_plan_id) REFERENCES daily_plans(id)
    );
  `);

  // Auto-migration columns for users table
  const userColumns = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!userColumns.includes('nrp')) {
    db.exec('ALTER TABLE users ADD COLUMN nrp TEXT;');
  }
  if (!userColumns.includes('dept')) {
    db.exec('ALTER TABLE users ADD COLUMN dept TEXT;');
  }
  if (!userColumns.includes('bp_cookies')) {
    db.exec('ALTER TABLE users ADD COLUMN bp_cookies TEXT;');
  }
  if (!userColumns.includes('bp_cookies_updated_at')) {
    db.exec('ALTER TABLE users ADD COLUMN bp_cookies_updated_at DATETIME;');
  }

  // Auto-migration columns for surat_tugas table
  const stColumns = db.prepare('PRAGMA table_info(surat_tugas)').all().map(c => c.name);
  if (!stColumns.includes('ess_form_id')) {
    db.exec('ALTER TABLE surat_tugas ADD COLUMN ess_form_id INTEGER;');
  }

  // Auto-migration columns for work_orders table
  const woColumns = db.prepare('PRAGMA table_info(work_orders)').all().map(c => c.name);
  if (!woColumns.includes('serial_number')) {
    db.exec('ALTER TABLE work_orders ADD COLUMN serial_number TEXT;');
  }

  // Default demo user if empty
  const userCheck = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCheck.count === 0) {
    db.prepare(`
      INSERT INTO users (username, fullname, bp_login, bp_password)
      VALUES (?, ?, ?, ?)
    `).run('mekanik', 'Mekanik Lapangan', '', '');
  }

  console.log('[Database] Native SQLite initialized.');
}

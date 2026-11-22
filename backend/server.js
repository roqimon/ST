import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { db, initDatabase } from './db.js';
import { syncBitrixData, fetchWorkOrdersFromBP } from './bp-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e5)}${ext}`;
    cb(null, unique);
  }
});
const upload = multer({ storage });

initDatabase();

const app = express();
const PORT = 3005;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(ROOT_DIR, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Current session user helper (for demo, defaults to first user)
const DEFAULT_USER_ID = 1;

// ==================== SURAT TUGAS API ====================
app.get('/api/st', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  let q = `
    SELECT st.*, 
      COALESCE((SELECT SUM(amount) FROM expenses WHERE st_id = st.id), 0) as total_expenses,
      (SELECT COUNT(*) FROM daily_plans WHERE st_id = st.id) as total_days
    FROM surat_tugas st
    WHERE user_id = ?
    ORDER BY start_date DESC
  `;
  if (limit) {
    q += ` LIMIT ${limit}`;
  }
  const stList = db.prepare(q).all(DEFAULT_USER_ID);
  res.json(stList);
});

app.post('/api/st', (req, res) => {
  const { st_number, title, advance_money, start_date, end_date } = req.body;
  if (!st_number || !start_date || !end_date) {
    return res.status(400).json({ error: 'Data Surat Tugas tidak lengkap.' });
  }

  const result = db.prepare(`
    INSERT INTO surat_tugas (user_id, st_number, title, advance_money, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(DEFAULT_USER_ID, st_number.trim(), title || `Dinas ${st_number}`, advance_money || 0, start_date, end_date);

  const stId = result.lastInsertRowid;

  // Auto generate daily plans between start_date and end_date
  const curr = new Date(start_date);
  const end = new Date(end_date);
  const insertDaily = db.prepare(`
    INSERT OR IGNORE INTO daily_plans (st_id, date, upd_amount)
    VALUES (?, ?, ?)
  `);

  while (curr <= end) {
    const dStr = curr.toISOString().split('T')[0];
    insertDaily.run(stId, dStr, 132500);
    curr.setDate(curr.getDate() + 1);
  }

  res.json({ success: true, st_id: stId });
});

app.get('/api/st/:id', (req, res) => {
  const st = db.prepare('SELECT * FROM surat_tugas WHERE id = ?').get(req.params.id);
  if (!st) return res.status(400).json({ error: 'ST tidak ditemukan' });

  const days = db.prepare(`
    SELECT dp.*, 
      COALESCE((SELECT SUM(amount) FROM expenses WHERE daily_plan_id = dp.id), 0) as day_expenses
    FROM daily_plans dp
    WHERE dp.st_id = ?
    ORDER BY dp.date DESC
  `).all(st.id);

  const totalExpense = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE st_id = ?').get(st.id)?.total || 0;

  res.json({ st, days, total_expenses: totalExpense });
});

// Update day setting (WO, Keterangan, UPD)
app.put('/api/daily-plan/:id', (req, res) => {
  const { wo_number, job_description, customer, upd_amount } = req.body;
  db.prepare(`
    UPDATE daily_plans 
    SET wo_number = ?, job_description = ?, customer = ?, upd_amount = ?
    WHERE id = ?
  `).run(wo_number || '', job_description || '', customer || '', upd_amount !== undefined ? upd_amount : 132500, req.params.id);
  res.json({ success: true });
});

// ==================== WORK ORDERS API ====================
app.get('/api/wo', (req, res) => {
  const includeClosed = req.query.include_closed === 'true';
  const query = includeClosed
    ? `SELECT * FROM work_orders 
       WHERE wo_number != 'Worktime'
       ORDER BY 
         CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
         CAST(wo_number AS INTEGER) DESC,
         id DESC`
    : `SELECT * FROM work_orders 
       WHERE status = 'ACTIVE' AND wo_number != 'Worktime'
       ORDER BY CAST(wo_number AS INTEGER) DESC, id DESC`;
  const wos = db.prepare(query).all();
  res.json(wos);
});

app.post('/api/wo', (req, res) => {
  const { wo_number, customer, unit_model, job_description, status } = req.body;
  if (!wo_number) return res.status(400).json({ error: 'Nomor WO wajib diisi' });

  try {
    db.prepare(`
      INSERT INTO work_orders (wo_number, customer, unit_model, job_description, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(wo_number.trim(), customer || '', unit_model || '', job_description || '', status || 'ACTIVE');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'WO sudah ada atau error: ' + err.message });
  }
});

// GET / PUT User BP Account Settings
app.get('/api/user/bp-account', (req, res) => {
  const user = db.prepare('SELECT id, username, fullname, bp_login FROM users WHERE id = ?').get(DEFAULT_USER_ID);
  res.json(user || {});
});

app.post('/api/user/bp-account', (req, res) => {
  const { bp_login, bp_password } = req.body;
  if (!bp_login) {
    return res.status(400).json({ error: 'Username BP wajib diisi' });
  }

  if (bp_password) {
    db.prepare(`
      UPDATE users 
      SET bp_login = ?, bp_password = ?
      WHERE id = ?
    `).run(bp_login.trim(), bp_password, DEFAULT_USER_ID);
  } else {
    db.prepare(`
      UPDATE users 
      SET bp_login = ?
      WHERE id = ?
    `).run(bp_login.trim(), DEFAULT_USER_ID);
  }

  res.json({ success: true, message: 'Kredensial BP berhasil disimpan.' });
});

// SYNC DATA (WO & SURAT TUGAS & PROFIL) FROM apps.binapertiwi.co.id
app.post('/api/wo/sync', async (req, res) => {
  try {
    let { bp_login, bp_password } = req.body;
    
    const user = db.prepare('SELECT bp_login, bp_password, bp_cookies FROM users WHERE id = ?').get(DEFAULT_USER_ID);
    
    if (!bp_login || !bp_password) {
      if (user && user.bp_login && user.bp_password) {
        bp_login = user.bp_login;
        bp_password = user.bp_password;
      }
    }

    if (!bp_login || !bp_password) {
      return res.status(400).json({
        error: 'Akun portal Bina Pertiwi belum disetting. Silakan masukkan Username & Password akun apps.binapertiwi Anda.'
      });
    }

    // Eksekusi HTTP Sync Bitrix dengan Smart Reusable Cookies
    const result = await syncBitrixData(bp_login, bp_password, user?.bp_cookies || null);

    // Simpan session cookie terbaru jika ada pembaruan sesi login
    if (result.cookies && result.cookies !== user?.bp_cookies) {
      db.prepare(`
        UPDATE users 
        SET bp_cookies = ?, bp_cookies_updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(result.cookies, DEFAULT_USER_ID);
    }

    // 1. Update profil karyawan jika terdeteksi
    if (result.employeeProfile) {
      db.prepare(`
        UPDATE users 
        SET fullname = ?, nrp = ?, dept = ?
        WHERE id = ?
      `).run(
        result.employeeProfile.pemohon || '',
        result.employeeProfile.nrp || '',
        result.employeeProfile.dept || '',
        DEFAULT_USER_ID
      );
    }

    // 2. Upsert data WO ke SQLite
    const upsertWoStmt = db.prepare(`
      INSERT INTO work_orders (wo_number, customer, unit_model, job_description, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(wo_number) DO UPDATE SET
        customer = excluded.customer,
        unit_model = excluded.unit_model,
        job_description = excluded.job_description,
        status = excluded.status
    `);

    let woCount = 0;
    for (const wo of result.workOrders) {
      upsertWoStmt.run(wo.wo_number, wo.customer, wo.unit_model, wo.job_description, wo.status);
      woCount++;
    }

    // 3. Upsert data Surat Tugas dari ESS ke SQLite
    let stCount = 0;
    const checkStStmt = db.prepare('SELECT id FROM surat_tugas WHERE st_number = ? AND user_id = ?');
    const insertStStmt = db.prepare(`
      INSERT INTO surat_tugas (user_id, st_number, title, advance_money, start_date, end_date, status, ess_form_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStStmt = db.prepare(`
      UPDATE surat_tugas 
      SET title = ?, start_date = ?, end_date = ?, ess_form_id = ?
      WHERE id = ?
    `);
    const insertDailyStmt = db.prepare(`
      INSERT OR IGNORE INTO daily_plans (st_id, date, upd_amount)
      VALUES (?, ?, ?)
    `);

    for (const st of result.stList) {
      if (!st.st_number || !st.start_date || !st.end_date) continue;
      const existing = checkStStmt.get(st.st_number, DEFAULT_USER_ID);
      let stId;
      if (existing) {
        stId = existing.id;
        updateStStmt.run(st.title, st.start_date, st.end_date, st.ess_form_id || null, stId);
      } else {
        const resSt = insertStStmt.run(
          DEFAULT_USER_ID,
          st.st_number,
          st.title,
          st.advance_money || 0,
          st.start_date,
          st.end_date,
          st.status || 'ACTIVE',
          st.ess_form_id || null
        );
        stId = resSt.lastInsertRowid;
      }

      // Generate hari-hari rencana dinas untuk ST jika belum ada
      try {
        const curr = new Date(st.start_date);
        const end = new Date(st.end_date);
        while (curr <= end) {
          const dStr = curr.toISOString().split('T')[0];
          insertDailyStmt.run(stId, dStr, 132500);
          curr.setDate(curr.getDate() + 1);
        }
      } catch (e) {}

      stCount++;
    }

    // Ambil daftar WO & ST terbaru
    const updatedWos = db.prepare("SELECT * FROM work_orders WHERE status = 'ACTIVE' ORDER BY id DESC").all();
    const updatedSts = db.prepare("SELECT * FROM surat_tugas WHERE user_id = ? ORDER BY id DESC").all(DEFAULT_USER_ID);
    const updatedUser = db.prepare("SELECT id, username, fullname, nrp, dept FROM users WHERE id = ?").get(DEFAULT_USER_ID);

    res.json({
      success: true,
      synced_wo_count: woCount,
      synced_st_count: stCount,
      employee: updatedUser,
      message: `Berhasil menyinkronkan ${stCount} Surat Tugas & ${woCount} Work Order aktif dari portal Bina Pertiwi.`,
      work_orders: updatedWos,
      surat_tugas: updatedSts
    });
  } catch (err) {
    console.error('[BP Sync Error]', err.message);
    res.status(500).json({
      error: err.message || 'Gagal menyinkronkan data dari portal Bina Pertiwi.'
    });
  }
});

// ==================== EXPENSES API ====================
app.get('/api/expenses', (req, res) => {
  const { st_id, date } = req.query;
  let q = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];
  if (st_id) { q += ' AND st_id = ?'; params.push(st_id); }
  if (date) { q += ' AND date = ?'; params.push(date); }
  q += ' ORDER BY id DESC';
  const items = db.prepare(q).all(...params);
  res.json(items);
});

// Single Expense Add
app.post('/api/expenses', upload.single('receipt'), (req, res) => {
  const { st_id, daily_plan_id, date, category, amount, keterangan, wo_number } = req.body;
  const receipt_path = req.file ? `/uploads/${req.file.filename}` : '';

  db.prepare(`
    INSERT INTO expenses (st_id, daily_plan_id, date, category, amount, keterangan, wo_number, receipt_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(st_id, daily_plan_id || null, date, category, parseInt(amount) || 0, keterangan || '', wo_number || '', receipt_path);

  res.json({ success: true });
});

// Multi-Day / Multi-WO Split Expense Add
app.post('/api/expenses/split', upload.single('receipt'), (req, res) => {
  try {
    const { st_id, category, splits_json, keterangan } = req.body;
    const splits = JSON.parse(splits_json); // array of { date, amount, wo_number, keterangan, daily_plan_id }
    const receipt_path = req.file ? `/uploads/${req.file.filename}` : '';

    const stmt = db.prepare(`
      INSERT INTO expenses (st_id, daily_plan_id, date, category, amount, keterangan, wo_number, receipt_path, is_shared_split)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const item of splits) {
      stmt.run(
        st_id,
        item.daily_plan_id || null,
        item.date,
        category,
        parseInt(item.amount) || 0,
        item.keterangan || keterangan || '',
        item.wo_number || '',
        receipt_path
      );
    }

    res.json({ success: true, count: splits.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Update single expense
app.put('/api/expenses/:id', upload.single('receipt'), (req, res) => {
  const { category, amount, keterangan, wo_number, date } = req.body;
  const expenseId = req.params.id;

  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
  if (!existing) return res.status(404).json({ error: 'Pengeluaran tidak ditemukan' });

  const receipt_path = req.file ? `/uploads/${req.file.filename}` : existing.receipt_path;

  db.prepare(`
    UPDATE expenses 
    SET category = ?, amount = ?, keterangan = ?, wo_number = ?, date = ?, receipt_path = ?
    WHERE id = ?
  `).run(
    category || existing.category,
    parseInt(amount) || existing.amount,
    keterangan !== undefined ? keterangan : existing.keterangan,
    wo_number !== undefined ? wo_number : existing.wo_number,
    date || existing.date,
    receipt_path,
    expenseId
  );

  res.json({ success: true });
});

// ==================== SUMMARY & WO ANALYSIS ====================
app.get('/api/st/:id/analysis', (req, res) => {
  const stId = req.params.id;

  // Breakdown by WO
  const woSummary = db.prepare(`
    SELECT 
      CASE WHEN wo_number IS NULL OR wo_number = '' THEN 'Tanpa WO (Overhead)' ELSE wo_number END as wo,
      SUM(amount) as total_amount,
      COUNT(*) as count_items
    FROM expenses
    WHERE st_id = ?
    GROUP BY wo
    ORDER BY total_amount DESC
  `).all(stId);

  // Breakdown by Category
  const catSummary = db.prepare(`
    SELECT category, SUM(amount) as total_amount, COUNT(*) as count_items
    FROM expenses
    WHERE st_id = ?
    GROUP BY category
    ORDER BY total_amount DESC
  `).all(stId);

  res.json({ by_wo: woSummary, by_category: catSummary });
});

// ==================== EKSPOR CSV / EXCEL ====================
app.get('/api/st/:id/export-csv', (req, res) => {
  const stId = req.params.id;
  const st = db.prepare('SELECT * FROM surat_tugas WHERE id = ?').get(stId);
  if (!st) return res.status(404).send('ST not found');

  const expenses = db.prepare(`
    SELECT e.date, e.category, e.amount, e.keterangan, e.wo_number
    FROM expenses e
    WHERE e.st_id = ?
    ORDER BY e.date ASC, e.id ASC
  `).all(stId);

  let csv = `Nomor ST,"${st.st_number}"\n`;
  csv += `Nama Tugas,"${st.title}"\n`;
  csv += `Uang Muka,${st.advance_money}\n\n`;
  csv += `Tanggal,Kategori,Nominal,Keterangan,Nomor WO\n`;

  expenses.forEach(row => {
    const cleanKet = (row.keterangan || '').replace(/"/g, '""');
    csv += `"${row.date}","${row.category}",${row.amount},"${cleanKet}","${row.wo_number || '-'}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Rekap_ST_${st.st_number.replace(/[\/\\]/g, '_')}.csv"`);
  res.send(csv);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ST Server] Running on http://localhost:${PORT}`);
});

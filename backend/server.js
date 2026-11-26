import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { db, initDatabase } from './db.js';
import { encryptSecret, decryptSecret, signToken, verifyToken } from './crypto-utils.js';
import { syncBitrixData, fetchWorkOrdersFromBP } from './bp-sync.js';
import { enqueueDeclarationJob, getJobStatus } from './job-queue.js';

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
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Maksimal 5 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak diizinkan. Gunakan JPG, PNG, WEBP, atau PDF.'));
    }
  }
});

initDatabase();

const app = express();
const PORT = 3005;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3005,http://127.0.0.1:3005,https://st.bisabaca.web.id')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Origin tidak diizinkan oleh CORS'));
  }
}));
app.use(express.json());
app.use(express.static(path.join(ROOT_DIR, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Auth middleware for all /api/* routes except /api/auth/login
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') return next();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan login ulang.' });
  }
  req.authUserId = Number(payload.userId);
  req.headers['x-user-id'] = String(req.authUserId);
  next();
});

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
  const { st_number, title, advance_money, start_date, end_date, allow_overlap } = req.body;
  if (!st_number || !start_date || !end_date) {
    return res.status(400).json({ error: 'Data Surat Tugas tidak lengkap.' });
  }

  if (!allow_overlap) {
    const overlap = db.prepare(`
      SELECT id, st_number, start_date, end_date FROM surat_tugas
      WHERE user_id = ? AND status = 'ACTIVE' AND start_date <= ? AND end_date >= ?
      LIMIT 1
    `).get(DEFAULT_USER_ID, end_date, start_date);
    if (overlap) {
      return res.status(409).json({
        error: `Rentang tanggal bertabrakan dengan ST ${overlap.st_number} (${overlap.start_date} s/d ${overlap.end_date}).`,
        overlap,
      });
    }
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

  // Otomatis tautkan transaksi non-ST yang masuk dalam rentang ST ini
  const autoLinkedCount = autoLinkUnassignedExpensesToSt(stId);

  res.json({ success: true, st_id: stId, auto_linked_count: autoLinkedCount });
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

// Fungsi otomatis tautkan transaksi non-ST (st_id IS NULL) ke ST yang sesuai periodenya
function autoLinkUnassignedExpensesToSt(stId) {
  const st = db.prepare('SELECT * FROM surat_tugas WHERE id = ?').get(stId);
  if (!st) return 0;

  // Dapatkan seluruh daily plans untuk ST ini
  const plans = db.prepare('SELECT id, date, wo_number FROM daily_plans WHERE st_id = ?').all(stId);
  const planMap = new Map();
  plans.forEach(p => planMap.set(p.date, p));

  // Ambil transaksi non-ST yang tanggalnya masuk dalam rentang ST ini
  const unassigned = db.prepare(`
    SELECT * FROM expenses 
    WHERE st_id IS NULL AND date >= ? AND date <= ?
  `).all(st.start_date, st.end_date);

  const insertPlan = db.prepare('INSERT OR IGNORE INTO daily_plans (st_id, date, upd_amount) VALUES (?, ?, 132500)');
  const updateExp = db.prepare('UPDATE expenses SET st_id = ?, daily_plan_id = ?, wo_number = CASE WHEN wo_number IS NULL OR wo_number = \'\' THEN ? ELSE wo_number END WHERE id = ?');

  let count = 0;
  for (const exp of unassigned) {
    let plan = planMap.get(exp.date);
    if (!plan) {
      insertPlan.run(stId, exp.date);
      plan = db.prepare('SELECT id, date, wo_number FROM daily_plans WHERE st_id = ? AND date = ?').get(stId, exp.date);
      if (plan) planMap.set(exp.date, plan);
    }
    const fallbackWo = plan ? (plan.wo_number || '') : '';
    updateExp.run(stId, plan ? plan.id : null, fallbackWo, exp.id);
    count++;
  }
  return count;
}
app.put('/api/daily-plan/:id', (req, res) => {
  const { wo_number, job_description, customer, upd_amount } = req.body;
  db.prepare(`
    UPDATE daily_plans 
    SET wo_number = ?, job_description = ?, customer = ?, upd_amount = ?
    WHERE id = ?
  `).run(wo_number || '', job_description || '', customer || '', upd_amount !== undefined ? upd_amount : 132500, req.params.id);
  res.json({ success: true });
});

// Auto-create or update daily plan by date & ST
app.post('/api/daily-plan', (req, res) => {
  const { st_id, date, wo_number, job_description, customer, upd_amount } = req.body;
  if (!st_id || !date) {
    return res.status(400).json({ error: 'st_id dan date wajib diisi' });
  }

  // Insert or update
  db.prepare(`
    INSERT INTO daily_plans (st_id, date, wo_number, job_description, customer, upd_amount)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(st_id, date) DO UPDATE SET
      wo_number = excluded.wo_number,
      job_description = excluded.job_description,
      customer = excluded.customer,
      upd_amount = excluded.upd_amount
  `).run(
    st_id,
    date,
    wo_number || '',
    job_description || '',
    customer || '',
    upd_amount !== undefined ? upd_amount : 132500
  );

  // Perbarui rentang start_date dan end_date ST jika tanggal ini memperluas periode dinas
  const st = db.prepare('SELECT start_date, end_date FROM surat_tugas WHERE id = ?').get(st_id);
  if (st) {
    let newStart = st.start_date;
    let newEnd = st.end_date;
    if (date < newStart) newStart = date;
    if (date > newEnd) newEnd = date;
    if (newStart !== st.start_date || newEnd !== st.end_date) {
      db.prepare('UPDATE surat_tugas SET start_date = ?, end_date = ? WHERE id = ?').run(newStart, newEnd, st_id);
    }
  }

  const savedPlan = db.prepare('SELECT * FROM daily_plans WHERE st_id = ? AND date = ?').get(st_id, date);
  res.json({ success: true, plan: savedPlan });
});

// ==================== WORK ORDERS API ====================
app.get('/api/wo', (req, res) => {
  const userId = Number(req.query.user_id || req.headers['x-user-id'] || DEFAULT_USER_ID);
  const includeClosed = req.query.include_closed === 'true';
  const query = includeClosed
    ? `SELECT * FROM work_orders 
       WHERE wo_number != 'Worktime' AND (user_id = ? OR user_id IS NULL)
       ORDER BY 
         CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
         CAST(wo_number AS INTEGER) DESC,
         id DESC`
    : `SELECT * FROM work_orders 
       WHERE wo_number != 'Worktime' AND (user_id = ? OR user_id IS NULL)
       ORDER BY CAST(wo_number AS INTEGER) DESC, id DESC
       LIMIT 200`;
  const wos = db.prepare(query).all(userId);
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

// ==================== AUTHENTICATION API (MULTI-USER VIA APPS BP) ====================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password Apps BP wajib diisi' });
  }

  const cleanUser = username.trim();
  let bpResult;
  try {
    bpResult = await syncBitrixData(cleanUser, password, null, { skipDetails: true });
  } catch (err) {
    return res.status(401).json({ error: 'Login Apps Bina Pertiwi gagal: ' + (err.message || 'Kredensial tidak valid') });
  }

  let user = db.prepare('SELECT id, username, fullname, bp_login FROM users WHERE username = ? OR bp_login = ?').get(cleanUser, cleanUser);

  const encryptedPass = encryptSecret(password);
  if (!user) {
    const info = db.prepare('INSERT INTO users (username, password, fullname, bp_login, bp_password, bp_cookies) VALUES (?, ?, ?, ?, ?, ?)').run(
      cleanUser,
      encryptedPass,
      cleanUser,
      cleanUser,
      encryptedPass,
      bpResult?.cookies || null
    );
    user = { id: info.lastInsertRowid, username: cleanUser, fullname: cleanUser, bp_login: cleanUser };
  } else {
    db.prepare('UPDATE users SET password = ?, bp_login = ?, bp_password = ?, bp_cookies = ?, fullname = ? WHERE id = ?').run(
      encryptedPass,
      cleanUser,
      encryptedPass,
      bpResult?.cookies || null,
      cleanUser,
      user.id
    );
  }

  const token = signToken({ userId: user.id, username: user.username });
  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, fullname: cleanUser, bp_login: cleanUser }
  });
});

// GET / PUT User BP Account Settings
app.get('/api/user/bp-account', (req, res) => {
  const userId = Number(req.query.user_id || req.headers['x-user-id'] || DEFAULT_USER_ID);
  const user = db.prepare('SELECT id, username, fullname, bp_login FROM users WHERE id = ?').get(userId);
  res.json(user || {});
});

app.post('/api/user/bp-account', (req, res) => {
  const userId = Number(req.body?.user_id || req.headers['x-user-id'] || DEFAULT_USER_ID);
  const { bp_login, bp_password } = req.body;
  if (!bp_login) {
    return res.status(400).json({ error: 'Username BP wajib diisi' });
  }

  if (bp_password) {
    db.prepare(`
      UPDATE users 
      SET bp_login = ?, bp_password = ?
      WHERE id = ?
    `).run(bp_login.trim(), bp_password, userId);
  } else {
    db.prepare(`
      UPDATE users 
      SET bp_login = ?
      WHERE id = ?
    `).run(bp_login.trim(), userId);
  }

  res.json({ success: true, message: 'Kredensial BP berhasil disimpan.' });
});

// SYNC DATA (WO & SURAT TUGAS & PROFIL) FROM apps.binapertiwi.co.id
app.post('/api/wo/sync', async (req, res) => {
  try {
    const userId = Number(req.body?.user_id || req.headers['x-user-id'] || DEFAULT_USER_ID);
    let { bp_login, bp_password } = req.body;
    
    const user = db.prepare('SELECT bp_login, bp_password, bp_cookies FROM users WHERE id = ?').get(userId);
    
    if (!bp_login || !bp_password) {
      if (user && user.bp_login && user.bp_password) {
        bp_login = user.bp_login;
        bp_password = decryptSecret(user.bp_password);
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
      INSERT INTO work_orders (user_id, wo_number, customer, unit_model, serial_number, job_description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(wo_number) DO UPDATE SET
        user_id = excluded.user_id,
        customer = CASE WHEN excluded.customer != '' AND excluded.customer != '-' THEN excluded.customer ELSE work_orders.customer END,
        unit_model = CASE WHEN excluded.unit_model != '' THEN excluded.unit_model ELSE work_orders.unit_model END,
        serial_number = CASE WHEN excluded.serial_number != '' THEN excluded.serial_number ELSE work_orders.serial_number END,
        job_description = excluded.job_description,
        status = excluded.status
    `);

    let woCount = 0;
    for (const wo of result.workOrders) {
      upsertWoStmt.run(userId, wo.wo_number, wo.customer, wo.unit_model, wo.serial_number || '', wo.job_description, wo.status);
      woCount++;
    }

    // 2b. Lengkapi WO lama milik user yang unit_model-nya masih kosong via FIND=<wo_number>
    const missingWos = db.prepare("SELECT wo_number FROM work_orders WHERE (user_id = ? OR user_id IS NULL) AND wo_number != 'Worktime' AND (unit_model IS NULL OR LENGTH(unit_model) = 0)").all(userId);
    if (missingWos.length > 0 && result.cookies) {
      const { parseWorkOrderHtml, parseWorkOrderDetailHtml } = await import('./bp-sync.js');
      for (const m of missingWos) {
        try {
          const fRes = await fetch(`https://apps.binapertiwi.co.id/workorder/lists.php?apply_filter=Y&FIND=${encodeURIComponent(m.wo_number)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': result.cookies }
          });
          const found = parseWorkOrderHtml(await fRes.text()).find(w => w.wo_number === m.wo_number);
          if (found?.detail_path) {
            const dRes = await fetch(`https://apps.binapertiwi.co.id${found.detail_path}`, {
              headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': result.cookies }
            });
            const d = parseWorkOrderDetailHtml(await dRes.text());
            if (d.unit_model || d.serial_number || d.customer) {
              db.prepare(`UPDATE work_orders SET unit_model = COALESCE(NULLIF(?, ''), unit_model), serial_number = COALESCE(NULLIF(?, ''), serial_number), customer = CASE WHEN LENGTH(?) > 0 AND ? != '-' THEN ? ELSE customer END WHERE wo_number = ?`)
                .run(d.unit_model, d.serial_number, d.customer, d.customer, d.customer, m.wo_number);
            }
          }
        } catch { /* abaikan error per item */ }
      }
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

      // Auto-link pengeluaran non-ST yang masuk dalam rentang tanggal ST ini
      autoLinkUnassignedExpensesToSt(stId);

      stCount++;
    }

    // Ambil daftar WO & ST terbaru
    const updatedWos = db.prepare("SELECT * FROM work_orders ORDER BY id DESC LIMIT 200").all();
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
  const { st_id, date, unassigned } = req.query;
  let q = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];
  if (unassigned === 'true' || unassigned === '1') {
    q += ' AND st_id IS NULL';
  } else if (st_id) {
    q += ' AND st_id = ?';
    params.push(st_id);
  }
  if (date) { q += ' AND date = ?'; params.push(date); }
  q += ' ORDER BY date DESC, id DESC';
  const items = db.prepare(q).all(...params);
  res.json(items);
});

// Single Expense Add (Bisa tanpa st_id / unassigned staging)
app.post('/api/expenses', upload.single('receipt'), (req, res) => {
  const { st_id, daily_plan_id, date, category, amount, keterangan, wo_number } = req.body;
  if (!(wo_number || '').trim()) {
    return res.status(400).json({ error: 'Nomor WO wajib diisi untuk setiap pengeluaran.' });
  }
  if (!(keterangan || '').trim()) {
    return res.status(400).json({ error: 'Keterangan wajib diisi untuk setiap pengeluaran.' });
  }
  if ((category || '').toUpperCase() !== 'UPD' && !req.file) {
    return res.status(400).json({ error: 'Nota wajib dilampirkan untuk pengeluaran selain UPD.' });
  }
  const receipt_path = req.file ? `/uploads/${req.file.filename}` : '';

  let parsedStId = null;
  let parsedDailyPlanId = null;
  if (date) {
    const matchedSt = db.prepare(`
      SELECT id FROM surat_tugas
      WHERE user_id = ? AND start_date <= ? AND end_date >= ?
      ORDER BY id DESC LIMIT 1
    `).get(DEFAULT_USER_ID, date, date);
    if (matchedSt) {
      parsedStId = matchedSt.id;
      db.prepare('INSERT OR IGNORE INTO daily_plans (st_id, date, upd_amount) VALUES (?, ?, 132500)').run(parsedStId, date);
      const plan = db.prepare('SELECT id FROM daily_plans WHERE st_id = ? AND date = ?').get(parsedStId, date);
      parsedDailyPlanId = plan ? plan.id : null;
    }
  }

  db.prepare(`
    INSERT INTO expenses (st_id, daily_plan_id, date, category, amount, keterangan, wo_number, receipt_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(parsedStId, parsedDailyPlanId, date, category, parseInt(amount) || 0, keterangan || '', wo_number || '', receipt_path);

  res.json({ success: true });
});

// Multi-Day / Multi-WO Split Expense Add
app.post('/api/expenses/split', upload.single('receipt'), (req, res) => {
  try {
    const { st_id, category, splits_json, keterangan } = req.body;
    const splits = JSON.parse(splits_json); // array of { date, amount, wo_number, keterangan, daily_plan_id }
    const receipt_path = req.file ? `/uploads/${req.file.filename}` : '';
    const parsedStId = (st_id && st_id !== 'null' && st_id !== 'undefined' && st_id !== '') ? parseInt(st_id) : null;

    const stmt = db.prepare(`
      INSERT INTO expenses (st_id, daily_plan_id, date, category, amount, keterangan, wo_number, receipt_path, is_shared_split)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const item of splits) {
      stmt.run(
        parsedStId,
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

// Bulk assign / link unassigned expenses to ST
app.post('/api/expenses/assign-to-st', (req, res) => {
  try {
    const { st_id, expense_ids } = req.body;
    if (!st_id || !Array.isArray(expense_ids) || expense_ids.length === 0) {
      return res.status(400).json({ error: 'Data tidak lengkap (st_id dan expense_ids diperlukan).' });
    }

    const st = db.prepare('SELECT * FROM surat_tugas WHERE id = ?').get(st_id);
    if (!st) return res.status(404).json({ error: 'Surat Tugas tidak ditemukan' });

    // Dapatkan semua daily_plan yang ada pada ST ini
    const plans = db.prepare('SELECT id, date FROM daily_plans WHERE st_id = ?').all(st_id);
    const planMap = new Map();
    plans.forEach(p => planMap.set(p.date, p.id));

    const insertDailyPlan = db.prepare(`
      INSERT OR IGNORE INTO daily_plans (st_id, date, upd_amount)
      VALUES (?, ?, 132500)
    `);

    const updateExp = db.prepare(`
      UPDATE expenses 
      SET st_id = ?, daily_plan_id = ?
      WHERE id = ?
    `);

    const getExp = db.prepare('SELECT * FROM expenses WHERE id = ?');

    let updatedCount = 0;
    for (const expId of expense_ids) {
      const exp = getExp.get(expId);
      if (!exp) continue;

      let planId = planMap.get(exp.date);
      if (!planId) {
        // Jika tanggal pengeluaran belum ada di daily_plan ST ini (misal di luar range awal), auto buat hari baru
        insertDailyPlan.run(st_id, exp.date);
        const newPlan = db.prepare('SELECT id FROM daily_plans WHERE st_id = ? AND date = ?').get(st_id, exp.date);
        if (newPlan) {
          planId = newPlan.id;
          planMap.set(exp.date, planId);
        }
      }

      updateExp.run(st_id, planId || null, expId);
      updatedCount++;
    }

    res.json({ success: true, count: updatedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function deleteReceiptFile(receiptPath) {
  if (!receiptPath || typeof receiptPath !== 'string') return;
  const filename = path.basename(receiptPath);
  if (!filename) return;
  const fullPath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (e) {
      console.warn(`Gagal menghapus file nota ${filename}:`, e.message);
    }
  }
}

app.delete('/api/expenses/:id', (req, res) => {
  const existing = db.prepare('SELECT receipt_path FROM expenses WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  if (existing?.receipt_path) {
    deleteReceiptFile(existing.receipt_path);
  }
  res.json({ success: true });
});

app.post('/api/expenses/bulk-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID pengeluaran tidak valid' });
  }
  const cleanIds = ids.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0);
  if (cleanIds.length === 0) {
    return res.status(400).json({ error: 'Tidak ada ID valid untuk dihapus' });
  }

  try {
    db.exec('BEGIN IMMEDIATE');
    const placeholders = cleanIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT receipt_path FROM expenses WHERE id IN (${placeholders})`).all(...cleanIds);
    const result = db.prepare(`DELETE FROM expenses WHERE id IN (${placeholders})`).run(...cleanIds);
    db.exec('COMMIT');
    rows.forEach(r => deleteReceiptFile(r.receipt_path));
    res.json({ success: true, deletedCount: result.changes });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    res.status(500).json({ error: err.message });
  }
});

// Update single expense (Bisa ganti ST, WO, Tanggal, Kategori, Nominal, dll)
app.put('/api/expenses/:id', upload.single('receipt'), (req, res) => {
  const { category, amount, keterangan, wo_number, date, st_id } = req.body;
  const expenseId = req.params.id;

  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
  if (!existing) return res.status(404).json({ error: 'Pengeluaran tidak ditemukan' });

  const receipt_path = req.file ? `/uploads/${req.file.filename}` : existing.receipt_path;

  // Evaluasi st_id: bisa dipindahkan ke ST lain atau dilepas ke non-ST (null)
  let targetStId = existing.st_id;
  if (st_id !== undefined) {
    targetStId = (st_id && st_id !== 'null' && st_id !== 'undefined' && st_id !== '') ? parseInt(st_id) : null;
  }

  const newDate = date || existing.date;
  let targetDailyPlanId = null;

  if (targetStId && newDate) {
    let matchedPlan = db.prepare('SELECT id FROM daily_plans WHERE st_id = ? AND date = ?').get(targetStId, newDate);
    if (!matchedPlan) {
      // Buat daily_plan otomatis pada ST tujuan jika belum ada
      db.prepare('INSERT OR IGNORE INTO daily_plans (st_id, date, upd_amount) VALUES (?, ?, 132500)').run(targetStId, newDate);
      matchedPlan = db.prepare('SELECT id FROM daily_plans WHERE st_id = ? AND date = ?').get(targetStId, newDate);
    }
    targetDailyPlanId = matchedPlan ? matchedPlan.id : null;
  }

  db.prepare(`
    UPDATE expenses 
    SET st_id = ?, category = ?, amount = ?, keterangan = ?, wo_number = ?, date = ?, daily_plan_id = ?, receipt_path = ?
    WHERE id = ?
  `).run(
    targetStId,
    category || existing.category,
    parseInt(amount) || existing.amount,
    keterangan !== undefined ? keterangan : existing.keterangan,
    wo_number !== undefined ? wo_number : existing.wo_number,
    newDate,
    targetDailyPlanId,
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

// Trigger deklarasi otomatis ke Bitrix24 (masuk antrean background)
app.post('/api/st/:id/declare', (req, res) => {
  const stId = Number(req.params.id);
  const st = db.prepare('SELECT id FROM surat_tugas WHERE id = ?').get(stId);
  if (!st) return res.status(404).json({ error: 'Surat Tugas tidak ditemukan.' });

  const exps = db.prepare('SELECT date, category, wo_number, keterangan, receipt_path FROM expenses WHERE st_id = ?').all(stId);
  const missingWo = exps.filter(e => !(e.wo_number || '').trim());
  const missingKet = exps.filter(e => !(e.keterangan || '').trim());
  const missingReceipt = exps.filter(e => (e.category || '').toUpperCase() !== 'UPD' && !(e.receipt_path || '').trim());
  if (missingWo.length > 0 || missingKet.length > 0 || missingReceipt.length > 0) {
    return res.status(400).json({
      error: `Deklarasi ditolak: ${missingWo.length} tanpa No. WO, ${missingKet.length} tanpa keterangan, ${missingReceipt.length} non-UPD tanpa nota.`,
    });
  }

  const jobId = enqueueDeclarationJob(stId, DEFAULT_USER_ID);
  res.json({ success: true, jobId, status: 'pending' });
});

// Cek status job deklarasi
app.get('/api/jobs/:jobId', (req, res) => {
  const job = getJobStatus(Number(req.params.jobId));
  if (!job) return res.status(404).json({ error: 'Job tidak ditemukan.' });
  res.json(job);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ST Server] Running on http://localhost:${PORT}`);
});

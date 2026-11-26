import { db } from './db.js';
import { runBitrixAutofill } from './bitrix-autofill.js';

let isProcessing = false;

export function enqueueDeclarationJob(stId, userId) {
  const result = db.prepare(`
    INSERT INTO deklarasi_jobs (st_id, user_id, status, progress)
    VALUES (?, ?, 'pending', 'Menunggu antrean...')
  `).run(stId, userId);

  const jobId = result.lastInsertRowid;
  setImmediate(() => processQueue());
  return jobId;
}

export function getJobStatus(jobId) {
  return db.prepare('SELECT * FROM deklarasi_jobs WHERE id = ?').get(jobId);
}

async function processQueue(uploadsDir = 'uploads') {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (true) {
      const job = db.prepare(`
        SELECT * FROM deklarasi_jobs
        WHERE status = 'pending'
        ORDER BY id ASC
        LIMIT 1
      `).get();

      if (!job) break;

      db.prepare(`
        UPDATE deklarasi_jobs
        SET status = 'running', progress = 'Memulai proses deklarasi...', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(job.id);

      try {
        const st = db.prepare('SELECT * FROM surat_tugas WHERE id = ?').get(job.st_id);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(job.user_id);
        const dailyPlans = db.prepare('SELECT * FROM daily_plans WHERE st_id = ? ORDER BY date ASC').all(job.st_id);
        const expenses = db.prepare('SELECT * FROM expenses WHERE st_id = ? ORDER BY date ASC, id ASC').all(job.st_id);

        const result = await runBitrixAutofill({
          st,
          dailyPlans,
          expenses,
          cookies: user?.bp_cookies,
          uploadsDir,
          onProgress: (msg) => {
            db.prepare(`
              UPDATE deklarasi_jobs
              SET progress = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(msg, job.id);
          },
        });

        db.prepare(`
          UPDATE deklarasi_jobs
          SET status = 'completed', progress = 'Deklarasi selesai diproses.', screenshot_path = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(result.screenshotUrl, job.id);
      } catch (err) {
        db.prepare(`
          UPDATE deklarasi_jobs
          SET status = 'failed', progress = 'Gagal memproses deklarasi.', error_message = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(err.message, job.id);
      }
    }
  } finally {
    isProcessing = false;
  }
}

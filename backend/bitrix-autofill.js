import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'https://apps.binapertiwi.co.id';

const CATEGORY_MAP = {
  UPD: { cat: 'Upah Perjalanan Dinas', prefix: 'upd', addFn: 'addUpd' },
  Hotel: { cat: 'Hotel', prefix: 'hotel', addFn: 'addHotel' },
  Laundry: { cat: 'Hotel', prefix: 'hotel', addFn: 'addHotel' },
  Tiket: { cat: 'Ticket', prefix: 'ticket', addFn: 'addTicket' },
  Wrapping: { cat: 'Ticket', prefix: 'ticket', addFn: 'addTicket' },
  'Cuci Mobil': { cat: 'Taxi', prefix: 'taxi', addFn: 'addTaxi' },
  Taxi: { cat: 'Taxi', prefix: 'taxi', addFn: 'addTaxi' },
  Tol: { cat: 'Taxi', prefix: 'taxi', addFn: 'addTaxi' },
  Parkir: { cat: 'Taxi', prefix: 'taxi', addFn: 'addTaxi' },
  Fuel: { cat: 'Fuel', prefix: 'bbm', addFn: 'addBbm' },
};

/**
 * Mengelompokkan baris berdasarkan No WO lalu menggabungkan rentang tanggal
 * yang sama atau saling beririsan agar tidak ada tanggal ganda di Detail Perjalanan.
 */
export function buildMergedTrips(rows) {
  const groups = new Map();

  for (const r of rows) {
    const wo = (r.wo_number || '').trim();
    const dateStr = (r.date || '').trim();
    if (!wo || !dateStr) continue;

    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) continue;

    if (!groups.has(wo)) groups.set(wo, []);
    groups.get(wo).push(d);
  }

  if (groups.size === 0) return [];

  const rawRanges = [];
  for (const [wo, dates] of groups.entries()) {
    dates.sort((a, b) => a - b);
    rawRanges.push({
      start: dates[0],
      end: dates[dates.length - 1],
      wos: [wo],
    });
  }

  rawRanges.sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  for (const item of rawRanges) {
    const last = merged[merged.length - 1];
    if (last && item.start <= last.end) {
      if (item.end > last.end) last.end = item.end;
      for (const w of item.wos) {
        if (!last.wos.includes(w)) last.wos.push(w);
      }
    } else {
      merged.push({ start: item.start, end: item.end, wos: [...item.wos] });
    }
  }

  return merged.map((m) => ({
    startIso: m.start.toISOString().split('T')[0],
    endIso: m.end.toISOString().split('T')[0],
    startDmy: formatDmy(m.start),
    endDmy: formatDmy(m.end),
    woNumbers: m.wos.join(', '),
  }));
}

function formatDmy(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatIsoToDmy(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return null;
      return {
        name: part.slice(0, idx).trim(),
        value: part.slice(idx + 1).trim(),
        domain: 'apps.binapertiwi.co.id',
        path: '/',
      };
    })
    .filter(Boolean);
}

/**
 * Menjalankan headless Playwright untuk mengisi form deklarasi Bitrix24.
 */
export async function runBitrixAutofill({ st, dailyPlans, expenses, cookies, uploadsDir, onProgress }) {
  const log = (msg) => {
    if (onProgress) onProgress(msg);
  };

  if (!cookies) {
    throw new Error('AUTH_EXPIRED: Cookie sesi Bitrix24 belum tersedia. Silakan sinkronisasi/login terlebih dahulu.');
  }

  const mergedTrips = buildMergedTrips([...dailyPlans, ...expenses]);
  const screenshotDir = path.join(uploadsDir, 'screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  log('Membuka browser headless...');
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const cookieList = parseCookieHeader(cookies);
    if (cookieList.length > 0) {
      await context.addCookies(cookieList);
    }

    const page = await context.newPage();
    page.on('dialog', (dialog) => dialog.accept().catch(() => {}));

    const targetUrl = st.ess_form_id
      ? `${BASE_URL}/ess/form_deklarasidinas.php?id=${st.ess_form_id}`
      : `${BASE_URL}/ess/list_deklarasidinas.php`;

    log(`Membuka halaman deklarasi Bitrix24...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const html = await page.content();
    if (html.includes('USER_LOGIN') && html.includes('USER_PASSWORD')) {
      throw new Error('AUTH_EXPIRED: Sesi Bitrix24 sudah kedaluwarsa. Silakan login ulang.');
    }

    // 1. Isi Detail Perjalanan (deduplikasi tanggal)
    log(`Mengisi ${mergedTrips.length} baris Detail Perjalanan...`);
    for (let i = 0; i < mergedTrips.length; i++) {
      const trip = mergedTrips[i];
      if (i > 0) {
        await page.evaluate(() => typeof addTrip === 'function' && addTrip());
      }
      await page.locator(`#tripStart_${i}`).fill(trip.startDmy).catch(() => {});
      await page.locator(`#tripEnd_${i}`).fill(trip.endDmy).catch(() => {});
      await page.locator(`#tripLokasi_${i}`).selectOption('PALEMBANG').catch(() => {});
    }

    // 2. Isi Rincian Pengeluaran
    log(`Mengisi ${expenses.length} baris pengeluaran...`);
    const prefixCounts = {};
    for (const exp of expenses) {
      const mapping = CATEGORY_MAP[exp.category] || CATEGORY_MAP.Taxi;
      const idx = prefixCounts[mapping.prefix] || 0;
      prefixCounts[mapping.prefix] = idx + 1;

      if (idx > 0) {
        await page.evaluate((fnName) => {
          if (typeof window[fnName] === 'function') window[fnName]();
        }, mapping.addFn);
      }

      const dmy = formatIsoToDmy(exp.date);
      await page.locator(`#${mapping.prefix}Tanggal_${idx}`).fill(dmy).catch(() => {});
      await page.locator(`#${mapping.prefix}Nilai_${idx}`).fill(String(exp.amount || 0)).catch(() => {});
      const woDetail = [exp.wo_job_description, exp.wo_unit_model, exp.wo_serial_number].filter(Boolean).join(' ');
      const woContext = [woDetail, exp.wo_customer].filter(Boolean).join(' - ');
      const finalKeterangan = [exp.keterangan, woContext ? `(${woContext})` : ''].filter(Boolean).join(' ');
      if (finalKeterangan) {
        await page.locator(`#${mapping.prefix}Keterangan_${idx}`).fill(finalKeterangan).catch(() => {});
      }
      if (exp.receipt_path) {
        const absReceipt = path.join(uploadsDir, path.basename(exp.receipt_path));
        if (fs.existsSync(absReceipt)) {
          await page.locator(`#${mapping.prefix}File_${idx}`).setInputFiles(absReceipt).catch(() => {});
        }
      }
    }

    // 3. Simpan screenshot bukti sebelum/sesudah submit
    const shotName = `deklarasi_st_${st.id}_${Date.now()}.png`;
    const shotPath = path.join(screenshotDir, shotName);
    await page.screenshot({ path: shotPath, fullPage: true });
    log('Pengisian form selesai. Screenshot bukti tersimpan.');

    return {
      mergedTripsCount: mergedTrips.length,
      expensesCount: expenses.length,
      screenshotUrl: `/uploads/screenshots/${shotName}`,
    };
  } finally {
    await browser.close();
  }
}

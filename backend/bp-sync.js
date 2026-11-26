/**
 * Modul Sinkronisasi Bitrix Bina Pertiwi (Lightweight HTTP Client)
 * Dilengkapi Smart Session Persistence (Reusable Cookie)
 */

const BASE_URL = 'https://apps.binapertiwi.co.id';
const LIST_WO_URL = `${BASE_URL}/workorder/lists.php`;
const LIST_ST_URL = `${BASE_URL}/ess/list_deklarasidinas.php`;
const LOGIN_ACTION_URL = `${BASE_URL}/workorder/lists.php?login=yes`;

/**
 * Parsing HTML tabel Bitrix Work Order
 */
export function parseWorkOrderHtml(html) {
  const workOrders = [];

  if (html.includes('USER_LOGIN') && html.includes('USER_PASSWORD') && html.includes('form_auth')) {
    throw new Error('AUTH_EXPIRED');
  }

  const rowMatches = html.match(/<tr[^>]*class="[^"]*main-grid-row[^"]*"[\s\S]*?<\/tr>/gi) || [];

  for (const row of rowMatches) {
    if (row.includes('template_0') || row.includes('hidden="true"')) continue;

    const titleMatch = row.match(/<a[^>]*href="([^"]*)"[^>]*class="[^"]*task-title[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      || row.match(/<a[^>]*class="[^"]*task-title[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;

    const detail_path = (titleMatch[1] || '').trim();
    const rawTitle = titleMatch[2].replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
    const splitDash = rawTitle.split(/\s*-\s*/);
    const wo_number = (splitDash[0] || '').trim();
    const job_description = splitDash.slice(1).join(' - ').trim() || 'Servis / Inspeksi Unit';

    if (!wo_number || wo_number.length < 5) continue;

    let status = 'ACTIVE';
    if (/task-status-text-color-completed|completed|closed|selesai/i.test(row)) {
      status = 'CLOSED';
    }

    let customer = 'PT Bina Pertiwi';
    const projectLinkMatch = row.match(/<a[^>]*target="_blank"[^>]*>([\s\S]*?)<\/a>/i);
    if (projectLinkMatch) {
      customer = projectLinkMatch[1].replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
    }

    workOrders.push({
      wo_number,
      customer: customer || 'PT Bina Pertiwi Customer',
      unit_model: '',
      serial_number: '',
      job_description: job_description || 'Pekerjaan Servis Lapangan',
      status,
      detail_path
    });
  }

  const seen = new Set();
  const deduped = [];
  for (const item of workOrders) {
    if (!seen.has(item.wo_number)) {
      seen.add(item.wo_number);
      deduped.push(item);
    }
  }

  return deduped;
}

/**
 * Parsing HTML halaman detail Work Order (/workorder/view.php?id=...)
 * Mengambil Material (sebelum '/'), Serial Number, dan Customer Name.
 */
export function parseWorkOrderDetailHtml(html) {
  const result = { unit_model: '', serial_number: '', customer: '' };
  const rowMatches = [...html.matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*class="[^"]*task-detail-property-name[^"]*"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*class="[^"]*task-detail-property-value[^"]*"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi)];

  for (const m of rowMatches) {
    const label = m[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
    const rawVal = m[2].replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
    if (!rawVal || rawVal === '-') continue;

    if (label === 'material') {
      result.unit_model = rawVal.split('/')[0].trim();
    } else if (label === 'serial number') {
      result.serial_number = rawVal;
    } else if (label === 'customer name') {
      result.customer = rawVal;
    }
  }
  return result;
}

/**
 * Parsing HTML tabel Daftar Surat Tugas Dinas dari ESS (/ess/list_deklarasidinas.php)
 */
export function parseSuratTugasHtml(html) {
  const stList = [];

  if (html.includes('USER_LOGIN') && html.includes('USER_PASSWORD') && html.includes('form_auth')) {
    throw new Error('AUTH_EXPIRED');
  }

  const tableMatches = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
  let targetTable = '';
  for (const t of tableMatches) {
    if (t[0].includes('No. Registrasi Deklarasi') || t[0].includes('Tanggal Mulai')) {
      targetTable = t[0];
      break;
    }
  }

  let employeeProfile = null;

  if (targetTable) {
    const rows = [...targetTable.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i][0];
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

      if (cells.length >= 9 && cells[2]) {
        const no_st = cells[2];
        const pemohon = cells[3];
        const nrp = cells[4];
        const dept = cells[5];
        const tgl_pengajuan = cells[6];
        const tgl_mulai_raw = cells[7]; // DD/MM/YYYY
        const tgl_selesai_raw = cells[8]; // DD/MM/YYYY
        const keperluan = cells[9] || 'Dinas Lapangan';
        const customer = cells[10] || '';
        const lokasi = cells[11] || '';
        const status = cells[13] || 'ACTIVE';

        if (!employeeProfile && pemohon && nrp) {
          employeeProfile = { pemohon, nrp, dept };
        }

        const toIsoDate = (dStr) => {
          if (!dStr) return null;
          const parts = dStr.split('/');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
          return dStr;
        };

        const start_date = toIsoDate(tgl_mulai_raw);
        const end_date = toIsoDate(tgl_selesai_raw);

        const idMatch = row.match(/form_deklarasidinas\.php\?id=(\d+)/i);
        const ess_form_id = idMatch ? parseInt(idMatch[1]) : null;

        stList.push({
          st_number: no_st,
          title: keperluan + (lokasi ? ` (${lokasi})` : ''),
          pemohon,
          nrp,
          dept,
          start_date,
          end_date,
          advance_money: 0,
          customer,
          lokasi,
          status,
          ess_form_id
        });
      }
    }
  }

  return { stList, employeeProfile };
}

/**
 * Lakukan login ke portal Bitrix Bina Pertiwi dan kembalikan Cookie sesi yang valid
 */
async function authenticateBP(username, password) {
  if (!username || !password) {
    throw new Error('Username atau Password akun Bina Pertiwi belum diisi.');
  }

  const initRes = await fetch(LIST_WO_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  let cookies = extractCookies(initRes.headers);
  const initHtml = await initRes.text();

  let bitrixSessid = '';
  const sessidMatch = initHtml.match(/'bitrix_sessid'\s*:\s*'([a-f0-9]+)'/);
  if (sessidMatch) {
    bitrixSessid = sessidMatch[1];
  }

  const bodyParams = new URLSearchParams();
  bodyParams.append('AUTH_FORM', 'Y');
  bodyParams.append('TYPE', 'AUTH');
  bodyParams.append('backurl', '/workorder/lists.php');
  bodyParams.append('USER_LOGIN', username.trim());
  bodyParams.append('USER_PASSWORD', password);
  bodyParams.append('USER_REMEMBER', 'Y');
  if (bitrixSessid) {
    bodyParams.append('sessid', bitrixSessid);
  }

  const loginRes = await fetch(LOGIN_ACTION_URL, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'Referer': LIST_WO_URL
    },
    body: bodyParams.toString(),
    redirect: 'manual'
  });

  const loginCookies = extractCookies(loginRes.headers);
  cookies = mergeCookies(cookies, loginCookies);

  return cookies;
}

/**
 * Sinkronisasi Data Bitrix dengan Session Re-use (Cepat & Hemat)
 * Jika session cookie masih valid, tidak perlu login ulang.
 * Jika session expired, otomatis re-login menggunakan kredensial tersimpan.
 */
export async function syncBitrixData(username, password, existingCookies = null, options = {}) {
  let cookies = existingCookies;
  let newCookiesGenerated = false;

  const tryFetchData = async (activeCookie) => {
    // 1. Ambil WO
    const woMap = new Map();
    for (let page = 1; page <= 1; page++) {
      const pageUrl = page === 1
        ? `${LIST_WO_URL}?apply_filter=Y&clear_filter=Y`
        : `${LIST_WO_URL}?PAGEN_1=${page}&apply_filter=Y&clear_filter=Y`;
      const listWoRes = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': activeCookie,
          'Referer': LIST_WO_URL
        }
      });
      const woHtml = await listWoRes.text();
      const pageWos = parseWorkOrderHtml(woHtml);
      let added = 0;
      for (const w of pageWos) {
        if (!woMap.has(w.wo_number)) {
          woMap.set(w.wo_number, w);
          added++;
        }
      }
      if (added === 0) break;
    }
    const workOrders = Array.from(woMap.values());

    // 1b. Ambil detail WO (Material -> unit_model, Serial Number, Customer Name) secara batch
    if (!options.skipDetails) {
      const BATCH_SIZE = 15;
      for (let i = 0; i < workOrders.length; i += BATCH_SIZE) {
        const batch = workOrders.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (wo) => {
          if (!wo.detail_path) return;
          try {
            const detailUrl = wo.detail_path.startsWith('http') ? wo.detail_path : `${BASE_URL}${wo.detail_path}`;
            const detailRes = await fetch(detailUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': activeCookie,
                'Referer': LIST_WO_URL
              }
            });
            const detailHtml = await detailRes.text();
            const detail = parseWorkOrderDetailHtml(detailHtml);
            if (detail.unit_model) wo.unit_model = detail.unit_model;
            if (detail.serial_number) wo.serial_number = detail.serial_number;
            if (detail.customer) wo.customer = detail.customer;
          } catch {
            // Abaikan error per-item agar sinkronisasi WO lain tetap berjalan
          }
        }));
      }
    }

    // 2. Ambil ST ESS
    const listStRes = await fetch(LIST_ST_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': activeCookie,
        'Referer': LIST_WO_URL
      }
    });
    const stHtml = await listStRes.text();
    const { stList, employeeProfile } = parseSuratTugasHtml(stHtml);

    return { workOrders, stList, employeeProfile };
  };

  // Coba gunakan cookie lama jika ada
  if (cookies) {
    try {
      const data = await tryFetchData(cookies);
      return {
        success: true,
        session_reused: true,
        cookies,
        ...data
      };
    } catch (err) {
      if (err.message !== 'AUTH_EXPIRED') throw err;
      // Jika expired, lanjutkan ke re-login otomatis di bawah
    }
  }

  // Jika belum ada cookie atau expired, login baru
  cookies = await authenticateBP(username, password);
  newCookiesGenerated = true;

  try {
    const data = await tryFetchData(cookies);
    return {
      success: true,
      session_reused: false,
      cookies,
      ...data
    };
  } catch (err) {
    if (err.message === 'AUTH_EXPIRED') {
      throw new Error('Kredensial akun apps.binapertiwi salah atau akses ditolak.');
    }
    throw err;
  }
}

// Backward compatibility helper
export async function fetchWorkOrdersFromBP(username, password, existingCookies = null) {
  const result = await syncBitrixData(username, password, existingCookies);
  return {
    success: true,
    count: result.workOrders.length,
    workOrders: result.workOrders,
    cookies: result.cookies
  };
}

function extractCookies(headers) {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) return '';
  return setCookie
    .split(/,(?=[^;]+;)/g)
    .map(c => c.split(';')[0].trim())
    .join('; ');
}

function mergeCookies(oldCookies, newCookies) {
  const cookieMap = new Map();
  if (oldCookies) {
    oldCookies.split(';').forEach(c => {
      const [k, v] = c.split('=').map(s => s && s.trim());
      if (k) cookieMap.set(k, v);
    });
  }
  if (newCookies) {
    newCookies.split(';').forEach(c => {
      const [k, v] = c.split('=').map(s => s && s.trim());
      if (k) cookieMap.set(k, v);
    });
  }
  return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

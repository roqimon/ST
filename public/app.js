// ST Deklarasi Mobile PWA - CashFlow Style Logic with ST-Level Hierarchy
let currentSt = null;
let currentDays = [];
let allExpenses = [];
let allMasterWos = [];
let selectedManualCategory = 'Hotel';
let isListeningVoice = false;
let speechRecognizer = null;
let activeEditingDayId = null;

// Helpers & Formatters
const fmtRp = (num) => 'Rp ' + (Number(num) || 0).toLocaleString('id-ID');
const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const dayNamesShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatFullDate(dStr) {
  const d = new Date(dStr);
  return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortDate(dStr) {
  if (!dStr) return '';
  const d = new Date(dStr);
  return `${d.getDate()} ${monthNamesShort[d.getMonth()]}`;
}

function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const catIcons = {
  'Fuel': '⛽',
  'Hotel': '🏨',
  'Taxi': '🚕',
  'Ticket': '🎫',
  'Tiket': '🎫',
  'Airport Tax': '📦',
  'Upah Perjalanan Dinas': '💼',
  'UPD': '💼',
  'Tol': '🛣️',
  'Parkir': '🅿️',
  'Laundry': '🧺',
  'Cuci Mobil': '🚗'
};

// ==================== APP INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  initSpeechRecognition();
  await loadInitialData();
});

async function loadInitialData() {
  try {
    // Load Master WO cache (seluruh WO yang ada untuk unlimited search)
    try {
      const woRes = await fetch('/api/wo?include_closed=true');
      allMasterWos = await woRes.json();
    } catch(e) {}

    // Ambil daftar ST untuk cache selector & default ST terbaru
    const res = await fetch('/api/st');
    const list = await res.json();
    cachedStPickerList = list;
    if (list.length > 0) {
      await loadStDetail(list[0].id);
    }
  } catch (err) {
    console.error('Error load initial ST:', err);
  }
}

async function seedSampleData(stId) {
  try {
    const res = await fetch(`/api/st/${stId}`);
    const data = await res.json();
    const days = data.days;
    if (days.length >= 3) {
      // Day 1: 23 Sep (WO 6000073006)
      await fetch(`/api/daily-plan/${days[0].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wo_number: '6000073006',
          job_description: 'PS 2 MX5100 PT STEELINDO - BELITUNG',
          customer: 'PT STEELINDO WAHANA PERKASA',
          upd_amount: 132500
        })
      });
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          st_id: stId,
          daily_plan_id: days[0].id,
          date: days[0].date,
          category: 'Hotel',
          amount: 315000,
          keterangan: 'Hotel Harmoni Belitung (Malam 1)',
          wo_number: '6000073006'
        })
      });
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          st_id: stId,
          daily_plan_id: days[0].id,
          date: days[0].date,
          category: 'Taxi',
          amount: 300000,
          keterangan: 'Sewa Mobil Belitung',
          wo_number: '6000073006'
        })
      });

      // Day 2: 24 Sep (WO 6000073005)
      await fetch(`/api/daily-plan/${days[1].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wo_number: '6000073005',
          job_description: 'PS 2 MX5100 PT STEELINDO - BELITUNG',
          customer: 'PT STEELINDO WAHANA PERKASA',
          upd_amount: 132500
        })
      });
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          st_id: stId,
          daily_plan_id: days[1].id,
          date: days[1].date,
          category: 'Hotel',
          amount: 315000,
          keterangan: 'Hotel Harmoni Belitung (Malam 2)',
          wo_number: '6000073005'
        })
      });
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          st_id: stId,
          daily_plan_id: days[1].id,
          date: days[1].date,
          category: 'Taxi',
          amount: 300000,
          keterangan: 'Sewa Mobil Belitung',
          wo_number: '6000073005'
        })
      });

      // Day 3: 25 Sep (WO 6000073004)
      await fetch(`/api/daily-plan/${days[2].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wo_number: '6000073004',
          job_description: 'PS 2 MX5100 PT STEELINDO - BELITUNG',
          customer: 'PT STEELINDO WAHANA PERKASA',
          upd_amount: 132500
        })
      });
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          st_id: stId,
          daily_plan_id: days[2].id,
          date: days[2].date,
          category: 'Hotel',
          amount: 315000,
          keterangan: 'Hotel Harmoni Belitung (Malam 3)',
          wo_number: '6000073004'
        })
      });
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          st_id: stId,
          daily_plan_id: days[2].id,
          date: days[2].date,
          category: 'Fuel',
          amount: 350000,
          keterangan: 'SPBU 24.334 Tanjung Pandan',
          wo_number: '6000073004'
        })
      });
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          st_id: stId,
          daily_plan_id: days[2].id,
          date: days[2].date,
          category: 'Taxi',
          amount: 300000,
          keterangan: 'Sewa Mobil Belitung',
          wo_number: '6000073004'
        })
      });
    }
  } catch (e) {
    console.log('Seed error:', e);
  }
}

async function loadStDetail(stId) {
  try {
    const res = await fetch(`/api/st/${stId}`);
    const data = await res.json();
    currentSt = data.st;
    currentDays = data.days;

    // Load all expenses for this ST
    const expRes = await fetch(`/api/expenses?st_id=${stId}`);
    allExpenses = await expRes.json();

    // Top Balance Banner
    document.getElementById('st-number-badge').textContent = `ST # ${currentSt.st_number}`;
    document.getElementById('st-title-display').textContent = currentSt.title;
    document.getElementById('st-advance-val').textContent = fmtRp(currentSt.advance_money);

    // Calculate total including UPD of each day
    let grandTotalExpense = 0;
    currentDays.forEach(d => {
      grandTotalExpense += (d.upd_amount || 0);
    });
    allExpenses.forEach(e => {
      grandTotalExpense += (e.amount || 0);
    });

    const remain = currentSt.advance_money - grandTotalExpense;
    const remainEl = document.getElementById('st-remain-val');
    remainEl.textContent = fmtRp(remain);
    remainEl.className = remain >= 0 ? 'val remain' : 'val';
    if (remain < 0) remainEl.style.color = 'var(--danger)';

    if (currentDays.length > 0) {
      const first = currentDays[0].date;
      const last = currentDays[currentDays.length - 1].date;
      document.getElementById('st-date-badge').textContent = `${formatShortDate(first)} – ${formatShortDate(last)}`;
    }

    document.getElementById('st-total-expense-val').textContent = `Total: ${fmtRp(grandTotalExpense)}`;

    // Populate dropdowns in modals
    populateDateDropdowns();

    // Render 2-Level Hierarchy
    renderStHierarchy();

    // Check & update Unassigned Staging Box
    await checkUnassignedExpenses();
  } catch (err) {
    console.error('Error load ST detail:', err);
  }
}

function populateDateDropdowns() {
  const camSelect = document.getElementById('camera-date-select');
  const manSelect = document.getElementById('manual-date-select');
  const quickDateInput = document.getElementById('quick-input-date');
  const quickDateLabel = document.getElementById('quick-date-label');
  const quickWoInput = document.getElementById('quick-input-wo');
  const quickWoLabel = document.getElementById('quick-wo-label');

  if (camSelect) camSelect.innerHTML = '';
  if (manSelect) manSelect.innerHTML = '';

  const todayStr = getTodayDateStr();

  // Jika tanggal hari ini ada di luar periode ST, tambahkan opsi Hari Ini (Non-ST / Staging) di dropdown
  const hasTodayInSt = currentDays.some(d => d.date === todayStr);
  if (!hasTodayInSt) {
    const todayD = new Date(todayStr);
    const todayLabel = `Hari Ini (${dayNamesShort[todayD.getDay()]}, ${todayD.getDate()} ${monthNamesShort[todayD.getMonth()]}) - Luar ST`;
    if (camSelect) camSelect.add(new Option(todayLabel, todayStr));
    if (manSelect) manSelect.add(new Option(todayLabel, todayStr));
  }

  currentDays.forEach((day, idx) => {
    const d = new Date(day.date);
    const label = `${dayNamesShort[d.getDay()]}, ${d.getDate()} ${monthNamesShort[d.getMonth()]}`;
    const fullLabel = `${label} (WO: ${day.wo_number || '-'})`;
    
    if (camSelect) camSelect.add(new Option(fullLabel, day.date));
    if (manSelect) manSelect.add(new Option(fullLabel, day.date));
  });

  // Set default selected date di Quick Bar ke HARI INI
  const currentVal = quickDateInput ? quickDateInput.value : '';
  const chosenDate = currentVal || todayStr;
  if (quickDateInput) quickDateInput.value = chosenDate;
  if (quickDateLabel) {
    const d = new Date(chosenDate);
    const isToday = chosenDate === todayStr;
    quickDateLabel.textContent = `${isToday ? 'Hari Ini, ' : ''}${dayNamesShort[d.getDay()]}, ${d.getDate()} ${monthNamesShort[d.getMonth()]}`;
  }

  // Sinkronkan juga pilihan awal dropdown modal kamera & manual jika belum dipilih
  if (camSelect && (!camSelect.value || !currentVal)) camSelect.value = chosenDate;
  if (manSelect && (!manSelect.value || !currentVal)) manSelect.value = chosenDate;

  // Update Label Quick WO Trigger
  updateQuickWoTriggerLabel();
  updateQuickUpdShortcutsUI();

  renderInteractiveDatePicker();
  renderInteractiveWoPicker();
}

function updateQuickWoTriggerLabel() {
  const quickDateInput = document.getElementById('quick-input-date');
  const quickWoInput = document.getElementById('quick-input-wo');
  const quickWoLabel = document.getElementById('quick-wo-label');
  if (!quickWoLabel) return;

  const activeDate = quickDateInput ? quickDateInput.value : '';
  const activeDay = currentDays.find(d => d.date === activeDate) || (currentDays.length > 0 ? currentDays[0] : null);
  const selectedWoVal = quickWoInput ? quickWoInput.value : '';

  // Langsung tampilkan angka WO saja tanpa tulisan "ikuti WO harian"
  const woNum = selectedWoVal || (activeDay && activeDay.wo_number ? activeDay.wo_number : '-');
  quickWoLabel.innerHTML = `<strong style="color:var(--ink); font-size:12.5px; font-weight:850; letter-spacing:0.2px;">${woNum}</strong>`;
}

// State Kalender Picker
let calendarViewYear = null;
let calendarViewMonth = null;
let datePickerTarget = 'quick'; // 'quick' or 'edit-expense'

function renderInteractiveDatePicker() {
  const container = document.getElementById('interactive-date-grid');
  const monthYearLabel = document.getElementById('calendar-month-year');
  const summaryDate = document.getElementById('cal-summary-date');
  const summaryTotal = document.getElementById('cal-summary-total');

  if (!container) return;
  container.innerHTML = '';

  if (currentDays.length === 0) {
    container.innerHTML = '<div style="grid-column: span 7; text-align:center; padding:12px; color:var(--muted); font-size:12px;">Tidak ada tanggal dinas.</div>';
    return;
  }

  const activeDate = document.getElementById('quick-input-date')?.value || getTodayDateStr();
  const sortedAsc = [...currentDays].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Inisialisasi view month/year jika belum ada
  if (calendarViewYear === null || calendarViewMonth === null) {
    const baseDate = activeDate ? new Date(activeDate) : (sortedAsc.length > 0 ? new Date(sortedAsc[0].date) : new Date());
    calendarViewYear = baseDate.getFullYear();
    calendarViewMonth = baseDate.getMonth();
  }

  const year = calendarViewYear;
  const month = calendarViewMonth;

  if (monthYearLabel) {
    monthYearLabel.textContent = `${monthNames[month]} ${year}`;
  }

  // Tampilkan ringkasan tanggal aktif
  const currentSelectedDay = currentDays.find(d => d.date === activeDate);
  if (summaryDate && summaryTotal) {
    const selD = new Date(activeDate);
    if (currentSelectedDay) {
      const dayExps = allExpenses.filter(e => e.date === currentSelectedDay.date);
      let totalExpense = currentSelectedDay.upd_amount || 0;
      dayExps.forEach(e => totalExpense += e.amount);

      summaryDate.innerHTML = `Terpilih: <strong>${dayNamesShort[selD.getDay()]}, ${selD.getDate()} ${monthNamesShort[selD.getMonth()]}</strong> ${currentSelectedDay.wo_number ? `<span style="color:var(--muted); font-size:11px;">(WO: ${currentSelectedDay.wo_number})</span>` : ''}`;
      summaryTotal.textContent = fmtRp(totalExpense);
    } else {
      // Tanggal di luar ST (Non-ST / Staging)
      const dayExps = allExpenses.filter(e => e.date === activeDate);
      let totalExpense = 0;
      dayExps.forEach(e => totalExpense += e.amount);

      summaryDate.innerHTML = `Terpilih: <strong>${dayNamesShort[selD.getDay()]}, ${selD.getDate()} ${monthNamesShort[selD.getMonth()]}</strong> <span style="font-size:10px; background:#ffedd5; color:#c2410c; padding:1px 6px; border-radius:6px; font-weight:800; margin-left:4px;">Non-ST (Staging)</span>`;
      summaryTotal.textContent = fmtRp(totalExpense);
    }
  }

  // Cari tanggal awal bulan dan total hari di bulan ini
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Minggu

  // Kotak kosong sebelum hari pertama
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.style.cssText = 'height: 48px; border-radius: 12px; background: transparent;';
    container.appendChild(emptyCell);
  }

  // Buat map tanggal ST untuk lookup cepat
  const stDateMap = new Map();
  currentDays.forEach(day => {
    stDateMap.set(day.date, day);
  });

  // Render hari 1 sampai akhir bulan
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const stDay = stDateMap.get(dStr);
    const isPartOfSt = Boolean(stDay);
    const isSelected = dStr === activeDate;

    const cell = document.createElement('button');
    cell.type = 'button';

    if (isPartOfSt) {
      const dayExps = allExpenses.filter(e => e.date === dStr);
      let dayTotal = (stDay.upd_amount || 0);
      dayExps.forEach(e => dayTotal += e.amount);

      cell.style.cssText = `
        height: 56px;
        border-radius: 14px;
        border: ${isSelected ? '3px solid #f97316' : '1.5px solid #0284c7'};
        background: ${isSelected ? 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'};
        color: #ffffff;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: ${isSelected ? '0 0 0 3px rgba(249, 115, 22, 0.45), 0 4px 14px rgba(2, 132, 199, 0.5)' : '0 2px 6px rgba(2, 132, 199, 0.3)'};
        position: relative;
        padding: 4px 2px;
      `;

      cell.innerHTML = `
        <span style="font-size: 15px; font-weight: 850; line-height: 1; color: #ffffff;">${dayNum}</span>
        <span style="font-size: 8.5px; font-weight: 800; background: rgba(255, 255, 255, 0.22); color: #ffffff; padding: 1px 5px; border-radius: 6px; white-space: nowrap; margin-top: 1px;">
          ${dayTotal > 0 ? (dayTotal >= 1000000 ? (dayTotal/1000000).toFixed(1) + 'M' : Math.round(dayTotal/1000) + 'k') : 'ST'}
        </span>
      `;

      cell.onclick = () => {
        if (datePickerTarget === 'edit-expense') {
          updateEditExpDateLabel(dStr);
          document.getElementById('edit-exp-date')?.dispatchEvent(new Event('change'));
        } else {
          selectQuickDate(dStr);
        }
        closeModal('modal-date-picker');
      };
    } else {
      // Hari di luar Surat Tugas (Abu-abu netral; jika dipilih tetap abu-abu dengan aksen border/ring tegas agar tidak menyerupai ST aktif)
      cell.disabled = false;
      cell.style.cssText = `
        height: 56px;
        border-radius: 14px;
        border: ${isSelected ? '2.5px solid #475569' : '1px solid #e2e8f0'};
        background: ${isSelected ? '#e2e8f0' : '#f8fafc'};
        color: ${isSelected ? '#0f172a' : '#94a3b8'};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        cursor: pointer;
        transition: all 0.15s ease;
        padding: 4px 2px;
        box-shadow: ${isSelected ? '0 0 0 2px rgba(100, 116, 139, 0.35)' : 'none'};
      `;
      cell.innerHTML = `
        <span style="font-size: 14px; font-weight: ${isSelected ? '850' : '650'}; line-height: 1; color: ${isSelected ? '#0f172a' : '#64748b'};">${dayNum}</span>
        <span style="font-size: 7.5px; font-weight: 750; color: ${isSelected ? '#334155' : '#94a3b8'}; background: ${isSelected ? '#cbd5e1' : 'transparent'}; padding: 1px 4px; border-radius: 4px; white-space: nowrap; text-transform: uppercase;">Non-ST</span>
      `;
      cell.onclick = () => {
        if (datePickerTarget === 'edit-expense') {
          updateEditExpDateLabel(dStr);
          document.getElementById('edit-exp-date')?.dispatchEvent(new Event('change'));
        } else {
          selectQuickDate(dStr);
        }
        closeModal('modal-date-picker');
      };
    }

    container.appendChild(cell);
  }
}

function updateQuickUpdShortcutsUI() {
  const dateVal = document.getElementById('quick-input-date')?.value;
  const day = currentDays.find(d => d.date === dateVal);
  const btnHalf = document.getElementById('btn-quick-upd-half');
  const btnFull = document.getElementById('btn-quick-upd-full');

  if (!btnHalf || !btnFull) return;

  const currentUpd = day ? (day.upd_amount || 0) : 0;

  if (currentUpd === 79500) {
    btnHalf.style.border = '2px solid #2563eb';
    btnHalf.style.background = '#eff6ff';
    btnHalf.style.color = '#1d4ed8';

    btnFull.style.border = '1px solid #cbd5e1';
    btnFull.style.background = '#ffffff';
    btnFull.style.color = '#1e293b';
  } else if (currentUpd === 132500) {
    btnFull.style.border = '2px solid #ea580c';
    btnFull.style.background = '#fff7ed';
    btnFull.style.color = '#c2410c';

    btnHalf.style.border = '1px solid #cbd5e1';
    btnHalf.style.background = '#ffffff';
    btnHalf.style.color = '#1e293b';
  } else {
    btnHalf.style.border = '1px solid #cbd5e1';
    btnHalf.style.background = '#ffffff';
    btnHalf.style.color = '#1e293b';

    btnFull.style.border = '1px solid #cbd5e1';
    btnFull.style.background = '#ffffff';
    btnFull.style.color = '#1e293b';
  }
}

function selectQuickDate(dateStr) {
  const quickDateInput = document.getElementById('quick-input-date');
  const quickDateLabel = document.getElementById('quick-date-label');
  if (quickDateInput) quickDateInput.value = dateStr;
  
  const d = new Date(dateStr);
  const isToday = dateStr === getTodayDateStr();
  if (quickDateLabel) {
    quickDateLabel.textContent = `${isToday ? 'Hari Ini, ' : ''}${dayNamesShort[d.getDay()]}, ${d.getDate()} ${monthNamesShort[d.getMonth()]}`;
  }

  // Sinkronkan juga pilihan di modal kamera dan manual jika ada
  const camSelect = document.getElementById('camera-date-select');
  const manSelect = document.getElementById('manual-date-select');
  if (camSelect) {
    if (![...camSelect.options].some(o => o.value === dateStr)) {
      camSelect.add(new Option(`${dayNamesShort[d.getDay()]}, ${d.getDate()} ${monthNamesShort[d.getMonth()]} (Luar ST)`, dateStr));
    }
    camSelect.value = dateStr;
  }
  if (manSelect) {
    if (![...manSelect.options].some(o => o.value === dateStr)) {
      manSelect.add(new Option(`${dayNamesShort[d.getDay()]}, ${d.getDate()} ${monthNamesShort[d.getMonth()]} (Luar ST)`, dateStr));
    }
    manSelect.value = dateStr;
  }

  updateQuickWoTriggerLabel();
  updateQuickUpdShortcutsUI();

  // Trigger preview update jika sedang ada teks
  const quickInput = document.getElementById('quick-input-text');
  if (quickInput && quickInput.value.trim()) {
    quickDateInput?.dispatchEvent(new Event('change'));
  }

  renderInteractiveDatePicker();
  renderInteractiveWoPicker();
}

function renderInteractiveWoPicker(filterKeyword = '') {
  const container = document.getElementById('interactive-wo-list');
  const countEl = document.getElementById('wo-picker-count');
  if (!container) return;
  container.innerHTML = '';

  const activeDate = document.getElementById('quick-input-date')?.value;
  const activeDay = currentDays.find(d => d.date === activeDate) || (currentDays.length > 0 ? currentDays[0] : null);
  const defaultWoNum = activeDay ? activeDay.wo_number : '';
  const selectedWoVal = document.getElementById('quick-input-wo')?.value || '';

  // 1. Opsi Default: Ikuti WO Harian
  const isDefaultSelected = !selectedWoVal;
  const defaultCard = document.createElement('div');
  defaultCard.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1.5px solid ${isDefaultSelected ? 'var(--bp-orange)' : 'var(--line)'};
    background: ${isDefaultSelected ? 'var(--bp-orange-light)' : '#ffffff'};
    cursor: pointer;
    box-shadow: ${isDefaultSelected ? '0 4px 14px rgba(242, 92, 5, 0.12)' : '0 2px 6px rgba(0, 0, 0, 0.02)'};
  `;
  defaultCard.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 36px; height: 36px; border-radius: 10px; background: ${isDefaultSelected ? 'var(--bp-orange)' : '#f1f5f9'}; color: ${isDefaultSelected ? '#fff' : '#64748b'}; display: flex; align-items: center; justify-content: center; font-size: 16px;">
        ⚡
      </div>
      <div>
        <div style="font-size: 13.5px; font-weight: 850; color: ${isDefaultSelected ? 'var(--bp-orange-dark)' : 'var(--ink)'};">
          Ikuti WO Harian Otomatis
        </div>
        <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">
          Terkait tanggal dipilih: <strong>${defaultWoNum || 'Overhead (Tanpa WO)'}</strong>
        </div>
      </div>
    </div>
    <div>
      ${isDefaultSelected ? '<span style="font-weight:900; color:var(--bp-orange); font-size:16px;">✓</span>' : ''}
    </div>
  `;
  defaultCard.onclick = () => {
    selectQuickWo('');
    closeModal('modal-wo-picker');
  };
  container.appendChild(defaultCard);

  // 2. Filter list WO
  const kw = filterKeyword.toLowerCase().trim();
  const filtered = allMasterWos.filter(w => {
    if (!kw) return true;
    return (w.wo_number && w.wo_number.toLowerCase().includes(kw)) ||
           (w.customer && w.customer.toLowerCase().includes(kw)) ||
           (w.job_description && w.job_description.toLowerCase().includes(kw)) ||
           (w.unit_model && w.unit_model.toLowerCase().includes(kw)) ||
           (w.serial_number && w.serial_number.toLowerCase().includes(kw));
  });

  if (countEl) countEl.textContent = `${filtered.length} WO`;

  filtered.forEach(wo => {
    const isSelected = selectedWoVal === wo.wo_number;
    const isActive = wo.status === 'ACTIVE';

    // Format spesifik sesuai permintaan: No WO - Pekerjaan - Unit/Material SN
    // Contoh: 4200066042 - TS Electrical - FB25-12 103219
    const jobText = wo.job_description || 'Servis Unit';
    const unitText = [wo.unit_model, wo.serial_number].filter(Boolean).join(' ');
    const fullWoTitle = `${wo.wo_number} - ${jobText}${unitText ? ' - ' + unitText : ''}`;

    const card = document.createElement('div');
    card.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1.5px solid ${isSelected ? 'var(--bp-orange)' : 'var(--line)'};
      background: ${isSelected ? 'var(--bp-orange-light)' : '#ffffff'};
      cursor: pointer;
      box-shadow: ${isSelected ? '0 4px 14px rgba(242, 92, 5, 0.12)' : '0 2px 6px rgba(0, 0, 0, 0.02)'};
    `;

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
        <div style="width: 38px; height: 38px; border-radius: 10px; background: ${isSelected ? 'var(--bp-orange)' : (isActive ? '#fff7ed' : '#f1f5f9')}; color: ${isSelected ? '#fff' : (isActive ? 'var(--bp-orange-dark)' : '#64748b')}; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
          🛠️
        </div>
        <div style="min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-size: 13.5px; font-weight: 850; color: ${isSelected ? 'var(--bp-orange-dark)' : 'var(--ink)'};">
              ${wo.wo_number}
            </span>
            <span style="font-size: 9.5px; padding: 1px 6px; border-radius: 6px; font-weight: 800; background: ${isActive ? '#dcfce7; color:#15803d;' : '#f1f5f9; color:#64748b;'}">
              ${isActive ? 'ACTIVE' : 'CLOSED'}
            </span>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${jobText} ${unitText ? `<span style="color:var(--bp-orange); font-weight:800;">• ${unitText}</span>` : ''}
          </div>
          <div style="font-size: 10.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
            🏢 ${wo.customer || '-'}
          </div>
        </div>
      </div>
      <div style="margin-left: 8px; flex-shrink: 0;">
        ${isSelected ? '<span style="font-weight:900; color:var(--bp-orange); font-size:16px;">✓</span>' : '<span style="color:#cbd5e1; font-size:14px;">›</span>'}
      </div>
    `;

    card.onclick = () => {
      selectQuickWo(wo.wo_number);
      closeModal('modal-wo-picker');
    };

    container.appendChild(card);
  });
}

function selectQuickWo(woNumber) {
  const quickWoInput = document.getElementById('quick-input-wo');
  if (quickWoInput) quickWoInput.value = woNumber;

  updateQuickWoTriggerLabel();

  // Trigger preview update jika sedang ada input teks
  const quickInput = document.getElementById('quick-input-text');
  if (quickInput && quickInput.value.trim()) {
    quickWoInput?.dispatchEvent(new Event('change'));
  }

  renderInteractiveWoPicker();
}

// ==================== 2-LEVEL HIERARCHY RENDERING ====================
let expandedDayIds = new Set(['staging-group']); // Track expanded date accordion, default buka staging jika ada
let activeEditingExpenseId = null;

function renderStHierarchy() {
  const container = document.getElementById('st-hierarchy-container');
  container.innerHTML = '';

  currentDays.forEach((day, idx) => {
    const d = new Date(day.date);
    const dayExps = allExpenses.filter(e => e.date === day.date);

    // Calculate Total for this specific Date (UPD + Expenses)
    let dayTotal = day.upd_amount || 0;
    dayExps.forEach(e => dayTotal += e.amount);

    const isExpanded = expandedDayIds.has(day.id);

    // Date Group Accordion Card
    const card = document.createElement('div');
    card.className = `date-group ${isExpanded ? 'expanded' : ''}`;

    // 1. Level 1: Tanggal Header (KLIK UNTUK EXPAND / COLLAPSE)
    const header = document.createElement('div');
    header.className = 'date-group-header';
    header.onclick = () => toggleDayAccordion(day.id);

    header.innerHTML = `
      <div class="date-header-left">
        <span class="date-chevron">▶</span>
        <div class="date-badge">${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}</div>
      </div>
      <div class="date-right-box">
        <div class="date-total">${fmtRp(dayTotal)}</div>
      </div>
    `;
    card.appendChild(header);

    // Collapsible Body
    const collapseBody = document.createElement('div');
    collapseBody.className = 'date-collapse-body';

    // Work Order Harian Bar
    const woBar = document.createElement('div');
    woBar.className = 'day-wo-banner';
    woBar.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="day-wo-pill">${day.wo_number || '-'}</span>
        <span class="day-wo-job">${day.job_description || 'Pekerjaan belum diatur'}</span>
      </div>
      <button onclick="event.stopPropagation(); openEditDayWoModal(${day.id})" style="border:0; background:none; color:#1e56a0; font-weight:800; font-size:11px; cursor:pointer;">
        ✏️ Atur
      </button>
    `;
    collapseBody.appendChild(woBar);

    // 2. Level 2: List Pengeluaran pada Hari Ini
    const txList = document.createElement('div');
    txList.className = 'tx-list';

    // Item UPD (Auto)
    if (day.upd_amount > 0) {
      const updRow = document.createElement('div');
      updRow.className = 'tx-item';
      updRow.title = 'Klik untuk mengubah UPD harian';
      updRow.onclick = (e) => {
        e.stopPropagation();
        openEditDayWoModal(day.id);
      };

      updRow.innerHTML = `
        <div class="tx-left">
          <div class="tx-icon-box">💼</div>
          <div>
            <div class="tx-name">UPD (Uang Perjalanan Dinas)</div>
            <div class="tx-desc">
              ${day.wo_number ? `<span class="wo-chip">${day.wo_number}</span>` : ''}
              <span>Otomatis Harian</span>
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-val">${fmtRp(day.upd_amount)}</div>
          <span class="tag-auto">Auto</span>
        </div>
      `;
      txList.appendChild(updRow);
    }

    // Item-Item Riil (Bisa Diklik Untuk Diedit!)
    dayExps.forEach(exp => {
      const row = document.createElement('div');
      row.className = 'tx-item';
      row.title = 'Klik untuk mengedit atau menghapus pengeluaran ini';
      row.onclick = (e) => {
        e.stopPropagation();
        openEditExpenseModal(exp);
      };

      const icon = catIcons[exp.category] || '🧾';
      const receiptHtml = exp.receipt_path 
        ? `<a href="${exp.receipt_path}" target="_blank" onclick="event.stopPropagation();" class="tag-nota">📷 Nota</a>` 
        : '<span style="font-size:10px; color:var(--muted);">Tanpa Nota</span>';

      const assignedWo = exp.wo_number || day.wo_number || '';

      row.innerHTML = `
        <div class="tx-left">
          <div class="tx-icon-box">${icon}</div>
          <div>
            <div class="tx-name">${exp.category}</div>
            <div class="tx-desc">
              ${assignedWo ? `<span class="wo-chip">${assignedWo}</span>` : ''}
              <span>${exp.keterangan || '-'}</span>
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-val">${fmtRp(exp.amount)}</div>
          <div>${receiptHtml}</div>
        </div>
      `;
      txList.appendChild(row);
    });

    if (dayExps.length === 0 && (!day.upd_amount || day.upd_amount === 0)) {
      txList.innerHTML = `
        <div style="padding:14px; text-align:center; color:var(--muted); font-size:12px;">
          Belum ada transaksi di tanggal ini.
        </div>
      `;
    }

    // Tombol Cepat Tambah Pengeluaran Langsung di Tanggal Ini
    const addExpenseBtn = document.createElement('div');
    addExpenseBtn.style.cssText = 'padding: 8px 12px; margin-top: 6px; display: flex; justify-content: flex-end;';
    addExpenseBtn.innerHTML = `
      <button onclick="event.stopPropagation(); openQuickAddExpense('${day.date}', ${day.id})" 
              style="background:#f1f5f9; border:1px dashed #cbd5e1; color:#2563eb; font-size:12px; font-weight:700; padding:6px 12px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:4px;">
        ➕ Tambah Nota / Pengeluaran Hari Ini
      </button>
    `;
    collapseBody.appendChild(addExpenseBtn);

    collapseBody.appendChild(txList);
    card.appendChild(collapseBody);
    container.appendChild(card);
  });

  // ==================== SEKSI NON-ST (STAGING / DI LUAR PERIODE ST) ====================
  if (unassignedExpensesList && unassignedExpensesList.length > 0) {
    const unassignedTotal = unassignedExpensesList.reduce((sum, item) => sum + (item.amount || 0), 0);
    const isStagingExpanded = expandedDayIds.has('staging-group');

    // Buat pemisah visual & kartu grup
    const stagingCard = document.createElement('div');
    stagingCard.className = `date-group ${isStagingExpanded ? 'expanded' : ''}`;
    stagingCard.style.border = '1.5px dashed #f59e0b';
    stagingCard.style.background = '#fffbeb';
    stagingCard.style.marginTop = '14px';

    const stagingHeader = document.createElement('div');
    stagingHeader.className = 'date-group-header';
    stagingHeader.style.background = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
    stagingHeader.onclick = () => toggleDayAccordion('staging-group');

    stagingHeader.innerHTML = `
      <div class="date-header-left">
        <span class="date-chevron" style="color:#d97706;">▶</span>
        <div class="date-badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;">
          📦 Di Luar Periode ST (Non-ST)
        </div>
      </div>
      <div class="date-right-box">
        <span style="font-size:10px; background:#fde68a; color:#b45309; padding:2px 7px; border-radius:6px; font-weight:800; margin-right:4px;">
          ${unassignedExpensesList.length} Nota
        </span>
        <div class="date-total" style="color:#b45309;">${fmtRp(unassignedTotal)}</div>
      </div>
    `;
    stagingCard.appendChild(stagingHeader);

    const stagingCollapseBody = document.createElement('div');
    stagingCollapseBody.className = 'date-collapse-body';
    stagingCollapseBody.style.background = '#ffffff';

    // Banner info kecil di dalam seksi
    const stagingInfoBar = document.createElement('div');
    stagingInfoBar.style.cssText = 'padding: 10px 14px; background: #fffdf5; border-bottom: 1px dashed #fef08a; display: flex; justify-content: space-between; align-items: center;';
    stagingInfoBar.innerHTML = `
      <div style="font-size: 11.5px; color: #78350f; font-weight: 600;">
        Pengeluaran mandiri sebelum / di luar ST aktif. Klik nota untuk mengedit atau pindah ST.
      </div>
      <button onclick="event.stopPropagation(); openStagingModal();" 
              style="background:#f59e0b; border:none; color:#ffffff; font-size:11px; font-weight:800; padding:5px 10px; border-radius:8px; cursor:pointer; white-space:nowrap; margin-left:8px;">
        🔗 Tautkan ke ST
      </button>
    `;
    stagingCollapseBody.appendChild(stagingInfoBar);

    const stagingTxList = document.createElement('div');
    stagingTxList.className = 'tx-list';

    unassignedExpensesList.forEach(exp => {
      const row = document.createElement('div');
      row.className = 'tx-item';
      row.title = 'Klik untuk mengedit atau memindahkan ke ST';
      row.onclick = (e) => {
        e.stopPropagation();
        openEditExpenseModal(exp);
      };

      const icon = catIcons[exp.category] || '🧾';
      const receiptHtml = exp.receipt_path 
        ? `<a href="${exp.receipt_path}" target="_blank" onclick="event.stopPropagation();" class="tag-nota">📷 Nota</a>` 
        : '<span style="font-size:10px; color:var(--muted);">Tanpa Nota</span>';

      const d = new Date(exp.date);
      const dateBadge = `<span style="font-size:10px; font-weight:800; color:#475569; background:#f1f5f9; padding:2px 6px; border-radius:6px; margin-right:4px;">${d.getDate()} ${monthNamesShort[d.getMonth()]}</span>`;

      row.innerHTML = `
        <div class="tx-left">
          <div class="tx-icon-box" style="background:#fef3c7; border:1px solid #fde68a;">${icon}</div>
          <div>
            <div class="tx-name">${dateBadge} ${exp.category}</div>
            <div class="tx-desc">
              ${exp.wo_number ? `<span class="wo-chip">${exp.wo_number}</span>` : ''}
              <span>${exp.keterangan || 'Non-ST'}</span>
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-val" style="color:#b45309;">${fmtRp(exp.amount)}</div>
          <div>${receiptHtml}</div>
        </div>
      `;
      stagingTxList.appendChild(row);
    });

    stagingCollapseBody.appendChild(stagingTxList);
    stagingCard.appendChild(stagingCollapseBody);
    container.appendChild(stagingCard);
  }
}

window.openQuickAddExpense = function(targetDate, dayId) {
  const day = currentDays.find(d => d.id === dayId) || currentDays.find(d => d.date === targetDate);
  document.getElementById('manual-date-select').value = targetDate;
  document.getElementById('manual-amount').value = '';
  document.getElementById('manual-notes').value = '';
  document.getElementById('manual-wo').value = day ? (day.wo_number || '') : '';
  document.getElementById('manual-receipt-file').value = '';
  openModal('modal-manual');
};

function toggleDayAccordion(dayId) {
  if (expandedDayIds.has(dayId)) {
    expandedDayIds.delete(dayId);
  } else {
    expandedDayIds.add(dayId);
  }
  renderStHierarchy();
}

// ==================== EDIT EXPENSE MODAL ====================
function updateEditExpWoCard(woNum, isExplicit = false) {
  const inp = document.getElementById('edit-exp-wo');
  const display = document.getElementById('edit-exp-wo-display');
  const hint = document.getElementById('edit-exp-wo-hint');
  if (!inp || !display) return;

  const dateVal = document.getElementById('edit-exp-date')?.value;
  const day = currentDays.find(d => d.date === dateVal);
  const defaultWo = day ? (day.wo_number || '') : '';

  const finalWo = (woNum !== undefined && woNum !== null) ? woNum : (inp.value || defaultWo);
  inp.value = finalWo;

  if (finalWo) {
    const matchedWo = allMasterWos.find(w => w.wo_number === finalWo);
    display.innerHTML = `<span style="color:var(--bp-orange-dark);">${finalWo}</span>`;
    if (matchedWo && matchedWo.customer) {
      hint.textContent = `${matchedWo.customer} • ${matchedWo.job_description || '-'}`;
    } else if (finalWo === defaultWo && !isExplicit) {
      hint.textContent = '(Default: WO Harian Tanggal Ini)';
    } else {
      hint.textContent = '(WO Khusus Pengeluaran Ini)';
    }
  } else {
    display.textContent = 'Tanpa WO (Overhead)';
    hint.textContent = 'Biaya umum / tidak dibebankan ke unit';
  }
}

function setEditExpCategory(cat) {
  const inp = document.getElementById('edit-exp-cat');
  if (inp) inp.value = cat;

  document.querySelectorAll('.edit-cat-chip').forEach(chip => {
    if (chip.dataset.cat === cat) {
      chip.style.borderColor = 'var(--bp-orange)';
      chip.style.background = 'var(--bp-orange-light)';
      chip.style.color = 'var(--bp-orange-dark)';
    } else {
      chip.style.borderColor = 'var(--line)';
      chip.style.background = '#ffffff';
      chip.style.color = '#334155';
    }
  });
}

function formatNumberInputWithDots(rawStr) {
  const num = rawStr.replace(/\D/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('id-ID');
}

function updateEditExpDateLabel(dateStr) {
  const label = document.getElementById('edit-exp-date-label');
  const inp = document.getElementById('edit-exp-date');
  if (!label || !inp) return;

  inp.value = dateStr;
  const d = new Date(dateStr);
  label.textContent = `${dayNamesShort[d.getDay()]}, ${d.getDate()} ${monthNamesShort[d.getMonth()]} ${d.getFullYear()}`;
}

let editExpSelectedFile = null;

function openEditExpenseModal(exp) {
  activeEditingExpenseId = exp.id;
  editExpSelectedFile = null;

  // Set Tanggal
  updateEditExpDateLabel(exp.date);

  // Set Kategori Chips
  setEditExpCategory(exp.category);

  // Set Nominal dengan auto titik pemisah ribuan
  const amountStr = String(exp.amount || 0);
  document.getElementById('edit-exp-amount').value = amountStr;
  document.getElementById('edit-exp-amount-display').value = formatNumberInputWithDots(amountStr);

  document.getElementById('edit-exp-notes').value = exp.keterangan || '';
  document.getElementById('edit-exp-file-camera').value = '';
  document.getElementById('edit-exp-file-gallery').value = '';

  // Inisialisasi Pilihan ST di Modal Edit Expense
  const stSelect = document.getElementById('edit-exp-st-select');
  if (stSelect) {
    stSelect.innerHTML = '<option value="">📦 Non-ST (Simpan di Staging)</option>';
    if (cachedStPickerList && cachedStPickerList.length > 0) {
      cachedStPickerList.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st.id;
        opt.textContent = `📋 ${st.st_number} (${st.title})`;
        stSelect.appendChild(opt);
      });
    } else if (currentSt) {
      const opt = document.createElement('option');
      opt.value = currentSt.id;
      opt.textContent = `📋 ${currentSt.st_number} (${currentSt.title})`;
      stSelect.appendChild(opt);
    }
    stSelect.value = exp.st_id ? String(exp.st_id) : '';
  }

  // Inisialisasi WO
  const day = currentDays.find(d => d.date === exp.date);
  const initialWo = exp.wo_number || (day ? (day.wo_number || '') : '');
  updateEditExpWoCard(initialWo, Boolean(exp.wo_number));

  // Nota Preview Box
  const notaText = document.getElementById('edit-exp-current-nota');
  const notaImg = document.getElementById('edit-exp-img-preview');
  if (exp.receipt_path) {
    notaText.innerHTML = `Nota tersimpan: <a href="${exp.receipt_path}" target="_blank" style="color:var(--bp-orange); font-weight:800; text-decoration:underline;">Lihat Nota 📷</a>`;
    notaImg.style.display = 'block';
    notaImg.src = exp.receipt_path;
  } else {
    notaText.innerHTML = '<span style="color:var(--muted); font-weight:600;">Belum ada foto nota</span>';
    notaImg.style.display = 'none';
    notaImg.src = '';
  }

  openModal('modal-edit-expense');
}

// Make openEditDayWoModal accessible globally
window.openEditDayWoModal = function(dayId) {
  const day = currentDays.find(d => d.id === dayId);
  if (!day) return;
  activeEditingDayId = dayId;

  const d = new Date(day.date);
  document.getElementById('modal-edit-wo-date-label').textContent = 
    `Tanggal: ${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

  document.getElementById('input-wo-number').value = day.wo_number || '';
  document.getElementById('input-wo-customer').value = day.customer || '';
  document.getElementById('input-wo-desc').value = day.job_description || '';
  
  const updVal = day.upd_amount !== undefined ? day.upd_amount : 132500;
  document.getElementById('input-wo-upd').value = String(updVal);
  updateUpdSegButtons(updVal);

  updateEditWoTriggerCard(day.wo_number);

  openModal('modal-edit-wo');
};

function updateUpdSegButtons(val) {
  const btnOvernight = document.getElementById('btn-upd-overnight');
  const btnDaily = document.getElementById('btn-upd-daily');
  const numericVal = parseInt(val);

  if (btnOvernight && btnDaily) {
    if (numericVal === 132500) {
      btnOvernight.style.borderColor = '#2563eb';
      btnOvernight.style.background = '#eff6ff';
      btnDaily.style.borderColor = '#cbd5e1';
      btnDaily.style.background = '#fff';
    } else if (numericVal === 79500) {
      btnDaily.style.borderColor = '#2563eb';
      btnDaily.style.background = '#eff6ff';
      btnOvernight.style.borderColor = '#cbd5e1';
      btnOvernight.style.background = '#fff';
    } else {
      btnOvernight.style.borderColor = '#cbd5e1';
      btnOvernight.style.background = '#fff';
      btnDaily.style.borderColor = '#cbd5e1';
      btnDaily.style.background = '#fff';
    }
  }
}

function updateEditWoTriggerCard(woNumber) {
  const numEl = document.getElementById('display-selected-wo-num');
  const subEl = document.getElementById('display-selected-wo-subtitle');
  if (!numEl || !subEl) return;

  if (woNumber) {
    const found = allMasterWos.find(w => w.wo_number === woNumber);
    numEl.textContent = `WO #${woNumber}`;
    if (found) {
      const unitText = [found.unit_model, found.serial_number].filter(Boolean).join(' ');
      subEl.textContent = `${found.job_description || 'Servis Lapangan'}${unitText ? ' - ' + unitText : ''}`;
    } else {
      subEl.textContent = document.getElementById('input-wo-desc').value || 'Ketuk untuk mengganti WO';
    }
  } else {
    numEl.textContent = '(Belum Ada WO)';
    subEl.textContent = 'Ketuk untuk memilih dari master WO';
  }
}

let activeWoPickerTarget = 'edit-day'; // 'edit-day' or 'manual'

function renderFullWoPickerList(filterKeyword = '') {
  const container = document.getElementById('full-wo-items-container');
  const countEl = document.getElementById('full-wo-count');
  if (!container) return;
  container.innerHTML = '';

  const currentSelectedNum = activeWoPickerTarget === 'manual'
    ? document.getElementById('manual-wo')?.value?.trim()
    : (activeWoPickerTarget === 'edit-expense'
        ? document.getElementById('edit-exp-wo')?.value?.trim()
        : (activeWoPickerTarget.startsWith('split-day-')
            ? document.querySelector(`input[data-split-wo-for="${activeWoPickerTarget.replace('split-day-', '')}"]`)?.value?.trim()
            : document.getElementById('input-wo-number')?.value?.trim()));

  // Opsi 1: Kosongkan / Tanpa WO
  const emptyCard = document.createElement('div');
  emptyCard.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1.5px solid ${!currentSelectedNum ? 'var(--bp-orange)' : 'var(--line)'};
    background: ${!currentSelectedNum ? 'var(--bp-orange-light)' : '#ffffff'};
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.02);
  `;
  emptyCard.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="width:36px; height:36px; border-radius:10px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:16px;">
        ⚪
      </div>
      <div>
        <div style="font-size:13.5px; font-weight:850; color:var(--ink);">Tanpa WO (Overhead / Perjalanan)</div>
        <div style="font-size:11px; color:var(--muted); margin-top:1px;">Biaya tidak dibebankan ke unit customer</div>
      </div>
    </div>
    ${!currentSelectedNum ? '<span style="font-weight:900; color:var(--bp-orange); font-size:16px;">✓</span>' : ''}
  `;
  emptyCard.onclick = () => {
    if (activeWoPickerTarget === 'manual') {
      applySelectedWoToManual('', '');
    } else if (activeWoPickerTarget === 'edit-expense') {
      updateEditExpWoCard('', true);
    } else if (activeWoPickerTarget.startsWith('split-day-')) {
      const dayId = activeWoPickerTarget.replace('split-day-', '');
      applySelectedWoToSplitDay(dayId, '');
    } else {
      applySelectedWoToDay('', '', '');
    }
    closeModal('modal-full-wo-list');
  };
  container.appendChild(emptyCard);

  // Filter list
  const q = (filterKeyword || '').toLowerCase().trim();
  const filtered = allMasterWos.filter(item => {
    if (!q) return true;
    return (item.wo_number || '').toLowerCase().includes(q) ||
           (item.customer || '').toLowerCase().includes(q) ||
           (item.job_description || '').toLowerCase().includes(q) ||
           (item.unit_model || '').toLowerCase().includes(q) ||
           (item.serial_number || '').toLowerCase().includes(q);
  });

  if (countEl) countEl.textContent = `${filtered.length} WO`;

  filtered.forEach(wo => {
    const isSelected = currentSelectedNum && currentSelectedNum === wo.wo_number;
    const isActive = wo.status === 'ACTIVE';

    const jobText = wo.job_description || 'Servis Lapangan';
    const unitText = [wo.unit_model, wo.serial_number].filter(Boolean).join(' ');
    // Format lengkap: 4200066042 - TS Electrical - FB25-12 103219
    const fullWoTitle = `${wo.wo_number} - ${jobText}${unitText ? ' - ' + unitText : ''}`;

    const card = document.createElement('div');
    card.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1.5px solid ${isSelected ? 'var(--bp-orange)' : 'var(--line)'};
      background: ${isSelected ? 'var(--bp-orange-light)' : '#ffffff'};
      cursor: pointer;
      box-shadow: ${isSelected ? '0 4px 14px rgba(242, 92, 5, 0.12)' : '0 2px 6px rgba(0, 0, 0, 0.02)'};
      transition: all 0.15s ease;
    `;

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
        <div style="width: 38px; height: 38px; border-radius: 10px; background: ${isSelected ? 'var(--bp-orange)' : (isActive ? '#fff7ed' : '#f1f5f9')}; color: ${isSelected ? '#fff' : (isActive ? 'var(--bp-orange-dark)' : '#64748b')}; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
          🛠️
        </div>
        <div style="min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-size: 13.5px; font-weight: 850; color: ${isSelected ? 'var(--bp-orange-dark)' : 'var(--ink)'};">
              ${wo.wo_number}
            </span>
            <span style="font-size: 9.5px; padding: 1px 6px; border-radius: 6px; font-weight: 800; background: ${isActive ? '#dcfce7; color:#15803d;' : '#f1f5f9; color:#64748b;'}">
              ${isActive ? 'ACTIVE' : 'CLOSED'}
            </span>
            ${isSelected ? '<span style="font-size:9.5px; background:var(--bp-orange); color:#fff; padding:1px 6px; border-radius:6px; font-weight:800;">DIPILIH</span>' : ''}
          </div>
          <div style="font-size: 12px; font-weight: 750; color: #1e293b; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${jobText} ${unitText ? `<span style="color:var(--bp-orange); font-weight:800;">- ${unitText}</span>` : ''}
          </div>
          <div style="font-size: 10.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
            🏢 ${wo.customer || '-'}
          </div>
        </div>
      </div>
      <div style="margin-left: 8px; flex-shrink: 0;">
        ${isSelected ? '<span style="font-weight:900; color:var(--bp-orange); font-size:16px;">✓</span>' : '<span style="color:#cbd5e1; font-size:14px;">›</span>'}
      </div>
    `;

    card.onclick = () => {
      if (activeWoPickerTarget === 'manual') {
        applySelectedWoToManual(wo.wo_number, `${wo.wo_number} - ${jobText}${unitText ? ' - ' + unitText : ''}`);
      } else if (activeWoPickerTarget === 'edit-expense') {
        updateEditExpWoCard(wo.wo_number, true);
      } else if (activeWoPickerTarget.startsWith('split-day-')) {
        const dayId = activeWoPickerTarget.replace('split-day-', '');
        applySelectedWoToSplitDay(dayId, wo.wo_number);
      } else {
        applySelectedWoToDay(wo.wo_number, wo.customer || '', `${jobText}${unitText ? ' - ' + unitText : ''}`);
      }
      closeModal('modal-full-wo-list');
    };

    container.appendChild(card);
  });
}

function applySelectedWoToManual(woNum, fullDetail) {
  const inp = document.getElementById('manual-wo');
  const label = document.getElementById('manual-wo-label');
  if (inp) inp.value = woNum;
  if (label) {
    if (woNum) {
      label.innerHTML = `<strong style="color:var(--ink);">${woNum}</strong> <span style="font-size:11px; color:var(--muted); font-weight:600;">• ${fullDetail.split(' - ')[1] || ''}</span>`;
    } else {
      label.textContent = 'Tanpa WO (Overhead)';
    }
  }
}

function applySelectedWoToDay(woNum, customer, jobDesc) {
  document.getElementById('input-wo-number').value = woNum;
  document.getElementById('input-wo-customer').value = customer;
  document.getElementById('input-wo-desc').value = jobDesc;
  updateEditWoTriggerCard(woNum);
}

// ==================== 1. VOICE RECOGNITION ====================
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.lang = 'id-ID';
  speechRecognizer.continuous = false;
  speechRecognizer.interimResults = false;

  speechRecognizer.onresult = (event) => {
    const text = event.results[0][0].transcript;
    document.getElementById('voice-transcript').innerHTML = `Terdengar: <strong>"${text}"</strong>`;
    parseVoiceInput(text);
  };

  speechRecognizer.onerror = (event) => {
    document.getElementById('voice-transcript').textContent = 'Gagal mendengar suara: ' + event.error;
    document.getElementById('mic-pulse-anim').style.animation = 'none';
  };

  speechRecognizer.onend = () => {
    isListeningVoice = false;
    document.getElementById('mic-pulse-anim').style.animation = 'none';
  };
}

// Helper Parse Teks ke Objek Pengeluaran (Catat Cepat & Voice)
// Memetakan ke Kategori Aktual Form ESS Bina Pertiwi:
// 1. Fuel
// 2. Hotel (termasuk laundry)
// 3. Taxi (termasuk sewa mobil, grab, gojek, tol, parkir, cuci mobil)
// 4. Ticket (tiket pesawat, kapal, kereta, boarding)
// 5. Airport Tax (wrapping koper/bagasi, airport tax)
// 6. Upah Perjalanan Dinas (UPD / makan lapangan)
function parseTextToExpense(text) {
  const lower = text.toLowerCase().trim();
  let category = 'Fuel';
  let amount = 0;
  let isUpdShortcut = false;

  // Shortcut teks spesifik UPD:
  // "upd", "ups" (typo), "upd full", "upd menginap"
  if (lower === 'upd full' || lower === 'upd menginap') {
    category = 'Upah Perjalanan Dinas';
    amount = 132500;
    isUpdShortcut = true;
    return { category, amount, keterangan: 'UPD FULL 132.500', isUpdShortcut, updAmount: 132500 };
  } else if (lower === 'upd' || lower === 'ups' || lower === 'upd 79' || lower === 'upd 79500' || lower === 'upd 79.500') {
    category = 'Upah Perjalanan Dinas';
    amount = 79500;
    isUpdShortcut = true;
    return { category, amount, keterangan: 'UPD 79.500', isUpdShortcut, updAmount: 79500 };
  }

  if (lower.includes('hotel') || lower.includes('inap') || lower.includes('kamar') || lower.includes('wisma') || lower.includes('losmen')) {
    category = 'Hotel';
  } else if (lower.includes('laundry') || lower.includes('cuci baju')) {
    category = 'Hotel';
  } else if (lower.includes('wrapping') || lower.includes('wrap') || lower.includes('airport tax') || lower.includes('airporttax') || lower.includes('bagasi') || lower.includes('packing')) {
    category = 'Airport Tax';
  } else if (lower.includes('tiket') || lower.includes('ticket') || lower.includes('pesawat') || lower.includes('boarding') || lower.includes('kapal') || lower.includes('ferry') || lower.includes('kereta')) {
    category = 'Ticket';
  } else if (lower.includes('bensin') || lower.includes('solar') || lower.includes('bbm') || lower.includes('fuel') || lower.includes('spbu') || lower.includes('pertalite') || lower.includes('dex') || lower.includes('pertamax')) {
    category = 'Fuel';
  } else if (lower.includes('taxi') || lower.includes('taksi') || lower.includes('grab') || lower.includes('gojek') || lower.includes('maxim') || lower.includes('sewa') || lower.includes('rental')) {
    category = 'Taxi';
  } else if (lower.includes('tol') || lower.includes('etoll') || lower.includes('e-toll')) {
    category = 'Taxi';
  } else if (lower.includes('parkir') || lower.includes('parking')) {
    category = 'Taxi';
  } else if (lower.includes('cuci') || lower.includes('steam')) {
    category = 'Taxi';
  } else if (lower.includes('upd full') || lower.includes('upd menginap')) {
    category = 'Upah Perjalanan Dinas';
    amount = 132500;
  } else if (lower.includes('upd') || lower.includes('ups') || lower.includes('makan') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('sarapan') || lower.includes('resto') || lower.includes('warung')) {
    category = 'Upah Perjalanan Dinas';
  }

  // Amount parsing (jika belum ditentukan oleh shortcut UPD)
  if (!amount) {
    const jtMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:juta|jt)/);
    if (jtMatch) {
      amount = Math.round(parseFloat(jtMatch[1].replace(',', '.')) * 1000000);
    } else {
      const ribuMatch = lower.match(/(\d+)\s*(?:ribu|rb|k)/);
      if (ribuMatch) {
        amount = parseInt(ribuMatch[1]) * 1000;
      } else {
        const numMatch = lower.match(/\d[\d.,]*/g);
        if (numMatch) {
          // Ambil angka terbesar yang bukan pola nomor WO (bukan 10 digit 600...)
          const validNums = numMatch
            .map(n => parseInt(n.replace(/[.,]/g, '')))
            .filter(n => n > 0 && n < 100000000 && !String(n).startsWith('600') && !String(n).startsWith('610'));
          if (validNums.length > 0) amount = validNums[0];
        }
      }
    }
  }

  // Bersihkan teks keterangan
  let keterangan = text
    .replace(/\b(\d+)\s*(ribu|rb|k|juta|jt)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { category, amount, keterangan };
}

let parsedVoiceExpense = null;

function parseVoiceInput(text) {
  const parsed = parseTextToExpense(text);
  const category = parsed.category;
  const amount = parsed.amount;

  // Extract WO if spoken like 6000073004
  let wo = '';
  const woMatch = text.match(/\b\d{8,12}\b/);
  if (woMatch) {
    wo = woMatch[0];
  } else if (currentDays.length > 0) {
    wo = currentDays[0].wo_number || '';
  }

  const quickDateVal = document.getElementById('quick-input-date')?.value;
  const targetDate = quickDateVal || getTodayDateStr();

  parsedVoiceExpense = {
    category,
    amount,
    keterangan: text,
    wo_number: wo,
    date: targetDate
  };

  const resBox = document.getElementById('voice-parse-result');
  resBox.style.display = 'block';
  resBox.innerHTML = `
    <div style="font-size:12px; font-weight:800; color:var(--green); margin-bottom:4px;">Hasil Deteksi Suara:</div>
    <div>Tanggal: <strong>${formatShortDate(targetDate)}</strong></div>
    <div>Kategori: <strong>${category}</strong></div>
    <div>Nominal: <strong>${fmtRp(amount)}</strong></div>
    <div>Pembebanan WO: <strong>${wo || '(Sesuai Hari Ini)'}</strong></div>
  `;
  document.getElementById('btn-confirm-voice').style.display = 'block';
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Setup Quick Catat Cepat (CashFlow Style with Date & WO)
  const quickInput = document.getElementById('quick-input-text');
  const quickPreviewBox = document.getElementById('quick-preview-box');

  const updateQuickPreview = () => {
    const text = quickInput.value.trim();
    if (!text) {
      quickPreviewBox.style.display = 'none';
      return;
    }

    const parsed = parseTextToExpense(text);
    const dateVal = document.getElementById('quick-input-date').value;
    const woVal = document.getElementById('quick-input-wo').value;
    const day = currentDays.find(d => d.date === dateVal);
    const finalWo = woVal || (day ? day.wo_number : '-');

    quickPreviewBox.style.display = 'block';
    quickPreviewBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:800; color:#15803d;">${parsed.category} &bull; ${fmtRp(parsed.amount)}</span>
        <span style="font-size:10px; color:#64748b; font-weight:700;">WO: ${finalWo || '-'}</span>
      </div>
      <div style="font-size:11px; color:#334155; margin-top:2px;">"${parsed.keterangan || text}" &bull; ${formatShortDate(dateVal)}</div>
    `;
  };

  if (quickInput) {
    quickInput.addEventListener('input', updateQuickPreview);
    document.getElementById('quick-input-date')?.addEventListener('change', updateQuickPreview);
    document.getElementById('quick-input-wo')?.addEventListener('change', updateQuickPreview);

    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-quick-save').click();
      }
    });
  }

  // Modern Date Picker Modal Trigger & Navigasi Bulan (Prev/Next)
  document.getElementById('btn-open-date-picker')?.addEventListener('click', () => {
    datePickerTarget = 'quick';
    const activeDate = document.getElementById('quick-input-date')?.value;
    if (activeDate) {
      const d = new Date(activeDate);
      calendarViewYear = d.getFullYear();
      calendarViewMonth = d.getMonth();
    }
    renderInteractiveDatePicker();
    openModal('modal-date-picker');
  });

  document.getElementById('btn-close-date-picker')?.addEventListener('click', () => {
    closeModal('modal-date-picker');
  });

  document.getElementById('btn-cal-prev')?.addEventListener('click', () => {
    if (calendarViewMonth === 0) {
      calendarViewMonth = 11;
      calendarViewYear--;
    } else {
      calendarViewMonth--;
    }
    renderInteractiveDatePicker();
  });

  document.getElementById('btn-cal-next')?.addEventListener('click', () => {
    if (calendarViewMonth === 11) {
      calendarViewMonth = 0;
      calendarViewYear++;
    } else {
      calendarViewMonth++;
    }
    renderInteractiveDatePicker();
  });

  // Modern WO Picker Modal Trigger & Search
  document.getElementById('btn-open-wo-picker')?.addEventListener('click', () => {
    const searchInp = document.getElementById('wo-picker-search');
    if (searchInp) searchInp.value = '';
    renderInteractiveWoPicker('');
    openModal('modal-wo-picker');
  });

  document.getElementById('btn-close-wo-picker')?.addEventListener('click', () => {
    closeModal('modal-wo-picker');
  });

  document.getElementById('wo-picker-search')?.addEventListener('input', (e) => {
    renderInteractiveWoPicker(e.target.value);
  });

  // Quick Action Buttons
  const handleOpenVoice = () => {
    openModal('modal-voice');
    document.getElementById('voice-parse-result').style.display = 'none';
    document.getElementById('btn-confirm-voice').style.display = 'none';
    document.getElementById('voice-transcript').textContent = 'Silakan bicara: sebutkan pengeluaran, nominal, dan No WO...';
    document.getElementById('mic-pulse-anim').style.animation = 'pulseMic 1.5s infinite';

    if (speechRecognizer) {
      try {
        speechRecognizer.start();
        isListeningVoice = true;
      } catch (e) {
        console.log('Voice start error:', e);
      }
    } else {
      setTimeout(() => {
        const dummyText = 'Beli bensin solar 350 ribu SPBU Tanjung Pandan bebankan ke WO 6000073004';
        document.getElementById('voice-transcript').innerHTML = `Simulasi Suara: <strong>"${dummyText}"</strong>`;
        parseVoiceInput(dummyText);
      }, 1500);
    }
  };

  let selectedCameraFile = null;

  const handleOpenCamera = () => {
    selectedCameraFile = null;
    document.getElementById('camera-amount-input').value = '';
    document.getElementById('camera-notes-input').value = '';
    document.getElementById('camera-preview-box').style.display = 'none';
    document.getElementById('camera-file-capture').value = '';
    document.getElementById('camera-file-gallery').value = '';
    openModal('modal-camera');
  };

  document.getElementById('btn-quick-voice')?.addEventListener('click', handleOpenVoice);
  document.getElementById('btn-input-voice')?.addEventListener('click', handleOpenVoice);

  document.getElementById('btn-quick-camera')?.addEventListener('click', handleOpenCamera);
  document.getElementById('btn-input-camera')?.addEventListener('click', handleOpenCamera);

  // Shortcut UPD: 79.500 (UPD Standar) & 132.500 (UPD FULL / Menginap)
  const applyQuickUpd = async (amount, label) => {
    const dateVal = document.getElementById('quick-input-date').value || getTodayDateStr();
    const woVal = document.getElementById('quick-input-wo').value;
    const day = currentDays.find(d => d.date === dateVal);
    
    if (!currentSt) {
      alert('Pilih Surat Tugas tujuan terlebih dahulu.');
      return;
    }

    try {
      if (day) {
        // Tanggal sudah ada di dalam ST aktif
        await fetch(`/api/daily-plan/${day.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wo_number: woVal || day.wo_number,
            job_description: day.job_description,
            customer: day.customer,
            upd_amount: amount
          })
        });
        await loadStDetail(currentSt.id);
      } else {
        // Tanggal belum ada di ST aktif -> simpan murni sebagai expense non-ST kategori UPD di Staging
        const formData = new FormData();
        formData.append('date', dateVal);
        formData.append('category', 'Upah Perjalanan Dinas');
        formData.append('amount', amount);
        formData.append('keterangan', label || 'UPD Non-ST');
        formData.append('wo_number', woVal || '');

        await fetch('/api/expenses', { method: 'POST', body: formData });
        await checkUnassignedExpenses();
      }
    } catch (e) {
      console.error('Gagal update UPD:', e);
    }
  };

  document.getElementById('btn-quick-upd-half')?.addEventListener('click', () => {
    applyQuickUpd(79500, 'UPD 79.500');
  });

  document.getElementById('btn-quick-upd-full')?.addEventListener('click', () => {
    applyQuickUpd(132500, 'UPD Menginap 132.500');
  });

  document.getElementById('btn-quick-save')?.addEventListener('click', async () => {
    const text = quickInput.value.trim();
    if (!text) {
      alert('Tulis nama pengeluaran dan nominalnya (contoh: makan siang 35 ribu atau ketik upd)');
      quickInput.focus();
      return;
    }

    const parsed = parseTextToExpense(text);

    const dateVal = document.getElementById('quick-input-date').value;
    const woVal = document.getElementById('quick-input-wo').value;
    const day = currentDays.find(d => d.date === dateVal);
    const assignedWo = woVal || (day ? day.wo_number : '');

    // Jika shortcut UPD (upd / ups / upd full)
    if (parsed.isUpdShortcut) {
      if (!currentSt) {
        alert('Pilih Surat Tugas tujuan terlebih dahulu.');
        return;
      }
      try {
        if (day) {
          // Tanggal sudah ada dalam ST
          await fetch(`/api/daily-plan/${day.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wo_number: assignedWo,
              job_description: day.job_description,
              customer: day.customer,
              upd_amount: parsed.updAmount
            })
          });
          await loadStDetail(currentSt.id);
        } else {
          // Tanggal di luar ST aktif -> simpan murni sebagai expense non-ST (kategori UPD) di Staging
          const formData = new FormData();
          formData.append('date', dateVal);
          formData.append('category', 'Upah Perjalanan Dinas');
          formData.append('amount', parsed.updAmount);
          formData.append('keterangan', parsed.keterangan || 'UPD Non-ST');
          formData.append('wo_number', assignedWo);

          await fetch('/api/expenses', { method: 'POST', body: formData });
          await checkUnassignedExpenses();
        }
        quickInput.value = '';
        quickPreviewBox.style.display = 'none';
      } catch (e) {
        console.error('Gagal update UPD:', e);
      }
      return;
    }

    if (!parsed.amount || parsed.amount <= 0) {
      alert('Nominal belum terdeteksi. Contoh: makan siang 35 ribu atau bensin 150rb atau ketik upd');
      quickInput.focus();
      return;
    }

    const formData = new FormData();
    const isUnassigned = !currentSt || !day;
    if (!isUnassigned) {
      formData.append('st_id', currentSt.id);
      formData.append('daily_plan_id', day.id);
    }
    formData.append('date', dateVal);
    formData.append('category', parsed.category);
    formData.append('amount', parsed.amount);
    formData.append('keterangan', parsed.keterangan || text);
    formData.append('wo_number', assignedWo);

    await fetch('/api/expenses', { method: 'POST', body: formData });
    quickInput.value = '';
    quickPreviewBox.style.display = 'none';
    if (currentSt) {
      await loadStDetail(currentSt.id);
    }
    await checkUnassignedExpenses();
  });

  // Voice Modal
  const btnInpVoice = document.getElementById('btn-input-voice');
  if (btnInpVoice) btnInpVoice.onclick = handleOpenVoice;

  document.getElementById('btn-confirm-voice').onclick = async () => {
    if (!parsedVoiceExpense) return;
    const day = currentDays.find(d => d.date === parsedVoiceExpense.date);
    const bodyData = {
      date: parsedVoiceExpense.date,
      category: parsedVoiceExpense.category,
      amount: parsedVoiceExpense.amount,
      keterangan: parsedVoiceExpense.keterangan,
      wo_number: parsedVoiceExpense.wo_number
    };
    if (currentSt && day) {
      bodyData.st_id = currentSt.id;
      bodyData.daily_plan_id = day.id;
    }
    await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    closeModal('modal-voice');
    if (currentSt) {
      await loadStDetail(currentSt.id);
    }
    await checkUnassignedExpenses();
  };

  document.getElementById('btn-cancel-voice').onclick = () => {
    if (speechRecognizer && isListeningVoice) speechRecognizer.stop();
    closeModal('modal-voice');
  };

  // Upload Nota: 2 Pilihan (1. Kamera Langsung vs 2. Galeri)
  const inputCapture = document.getElementById('camera-file-capture');
  const inputGallery = document.getElementById('camera-file-gallery');

  const handleSelectedFile = (file, sourceName) => {
    if (!file) return;
    selectedCameraFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('camera-preview-box').style.display = 'block';
      document.getElementById('camera-img-preview').src = e.target.result;
      document.getElementById('camera-file-name').textContent = `Bukti (${sourceName}): ${file.name}`;
      if (!document.getElementById('camera-notes-input').value) {
        document.getElementById('camera-notes-input').value = `Nota ${sourceName}`;
      }
    };
    reader.readAsDataURL(file);
  };

  document.getElementById('btn-source-camera')?.addEventListener('click', () => {
    inputCapture?.click();
  });

  document.getElementById('btn-source-gallery')?.addEventListener('click', () => {
    inputGallery?.click();
  });

  inputCapture?.addEventListener('change', () => {
    if (inputCapture.files.length > 0) {
      handleSelectedFile(inputCapture.files[0], 'Kamera');
    }
  });

  inputGallery?.addEventListener('change', () => {
    if (inputGallery.files.length > 0) {
      handleSelectedFile(inputGallery.files[0], 'Galeri');
    }
  });

  const btnInpCamera = document.getElementById('btn-input-camera');
  if (btnInpCamera) btnInpCamera.onclick = handleOpenCamera;

  document.getElementById('btn-cancel-camera').onclick = () => closeModal('modal-camera');

  document.getElementById('btn-save-camera').onclick = async () => {
    const amount = document.getElementById('camera-amount-input').value;
    if (!amount || parseInt(amount) <= 0) {
      alert('Masukkan nominal pengeluaran');
      return;
    }

    const dateVal = document.getElementById('camera-date-select').value;
    const day = currentDays.find(d => d.date === dateVal);

    const formData = new FormData();
    if (day && currentSt) {
      formData.append('st_id', currentSt.id);
      formData.append('daily_plan_id', day.id);
    }
    formData.append('date', dateVal);
    formData.append('category', document.getElementById('camera-cat-select').value);
    formData.append('amount', amount);
    formData.append('keterangan', document.getElementById('camera-notes-input').value);
    formData.append('wo_number', document.getElementById('camera-wo-input').value.trim() || (day ? day.wo_number : ''));

    if (selectedCameraFile) {
      formData.append('receipt', selectedCameraFile);
    }

    await fetch('/api/expenses', { method: 'POST', body: formData });
    closeModal('modal-camera');
    if (currentSt) {
      await loadStDetail(currentSt.id);
    }
    await checkUnassignedExpenses();
  };

  // Manual Modal
  const btnInpManual = document.getElementById('btn-input-manual');
  if (btnInpManual) {
    btnInpManual.onclick = () => {
      document.getElementById('manual-amount').value = '';
      document.getElementById('manual-notes').value = '';
      
      const defaultWo = currentDays.length > 0 ? (currentDays[0].wo_number || '') : '';
      applySelectedWoToManual(defaultWo, defaultWo ? `WO #${defaultWo}` : '');
      
      document.getElementById('manual-receipt-file').value = '';
      openModal('modal-manual');
    };
  }

  document.getElementById('btn-cancel-manual').onclick = () => closeModal('modal-manual');

  document.querySelectorAll('#manual-cat-grid .cat-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#manual-cat-grid .cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedManualCategory = btn.dataset.cat;

      // Show/Hide opsi tarif UPD jika kategori UPD dipilih
      const updWrap = document.getElementById('manual-upd-type-wrap');
      const amountInp = document.getElementById('manual-amount');
      if (updWrap) {
        if (selectedManualCategory === 'UPD' || selectedManualCategory === 'Upah Perjalanan Dinas') {
          updWrap.style.display = 'block';
          if (!amountInp.value) amountInp.value = '132500';
        } else {
          updWrap.style.display = 'none';
        }
      }
    };
  });

  // Toggle UPD Menginap vs Tidak Menginap di Input Manual
  document.getElementById('btn-manual-upd-overnight')?.addEventListener('click', () => {
    document.getElementById('manual-amount').value = '132500';
    document.getElementById('btn-manual-upd-overnight').style.borderColor = '#2563eb';
    document.getElementById('btn-manual-upd-overnight').style.background = '#eff6ff';
    document.getElementById('btn-manual-upd-daily').style.borderColor = '#cbd5e1';
    document.getElementById('btn-manual-upd-daily').style.background = '#fff';
  });

  document.getElementById('btn-manual-upd-daily')?.addEventListener('click', () => {
    document.getElementById('manual-amount').value = '79500';
    document.getElementById('btn-manual-upd-daily').style.borderColor = '#2563eb';
    document.getElementById('btn-manual-upd-daily').style.background = '#eff6ff';
    document.getElementById('btn-manual-upd-overnight').style.borderColor = '#cbd5e1';
    document.getElementById('btn-manual-upd-overnight').style.background = '#fff';
  });

  // Toggle UPD Menginap vs Tidak Menginap di Modal Atur WO
  document.getElementById('btn-upd-overnight')?.addEventListener('click', () => {
    document.getElementById('input-wo-upd').value = '132500';
    updateUpdSegButtons(132500);
  });

  document.getElementById('btn-upd-daily')?.addEventListener('click', () => {
    document.getElementById('input-wo-upd').value = '79500';
    updateUpdSegButtons(79500);
  });

  document.getElementById('input-wo-upd')?.addEventListener('change', (e) => {
    updateUpdSegButtons(e.target.value);
  });

  document.getElementById('btn-save-manual').onclick = async () => {
    const amount = document.getElementById('manual-amount').value;
    if (!amount || parseInt(amount) <= 0) {
      alert('Masukkan nominal yang valid');
      return;
    }

    const dateVal = document.getElementById('manual-date-select').value;
    const day = currentDays.find(d => d.date === dateVal);

    const formData = new FormData();
    if (day && currentSt) {
      formData.append('st_id', currentSt.id);
      formData.append('daily_plan_id', day.id);
    }
    formData.append('date', dateVal);
    formData.append('category', selectedManualCategory);
    formData.append('amount', amount);
    formData.append('wo_number', document.getElementById('manual-wo').value.trim() || (day ? day.wo_number : ''));
    formData.append('keterangan', document.getElementById('manual-notes').value.trim());

    const manualFileInput = document.getElementById('manual-receipt-file');
    if (manualFileInput.files.length > 0) {
      formData.append('receipt', manualFileInput.files[0]);
    }

    await fetch('/api/expenses', { method: 'POST', body: formData });
    closeModal('modal-manual');
    if (currentSt) {
      await loadStDetail(currentSt.id);
    }
    await checkUnassignedExpenses();
  };

  // ST Picker Handlers
  document.getElementById('btn-st-list').onclick = async () => {
    try {
      // Ambil seluruh ST tersimpan (tidak dibatasi hanya 2) agar semua ST aktif terlihat
      const res = await fetch('/api/st');
      const sts = await res.json();
      renderStPickerList(sts);
      openModal('modal-st-picker');
    } catch(e) {
      alert('Gagal memuat daftar ST');
    }
  };

  // Master WO Search Handlers dari tombol icon header
  document.getElementById('btn-master-wo')?.addEventListener('click', () => {
    activeWoPickerTarget = 'header-search';
    const searchInp = document.getElementById('full-wo-search');
    if (searchInp) searchInp.value = '';
    renderFullWoPickerList('');
    openModal('modal-full-wo-list');
  });

  // Nav Tab Home: scroll halus ke atas
  document.getElementById('nav-tab-home')?.addEventListener('click', () => {
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('btn-close-st-picker').onclick = () => {
    closeModal('modal-st-picker');
  };

  // Edit WO Modal
  const closeEditWo = () => closeModal('modal-edit-wo');
  document.getElementById('btn-cancel-edit-wo').onclick = closeEditWo;
  document.getElementById('btn-back-edit-wo')?.addEventListener('click', closeEditWo);

  // Trigger buka Full WO List Modal dari Card WO di Atur WO
  document.getElementById('btn-trigger-wo-list')?.addEventListener('click', () => {
    activeWoPickerTarget = 'edit-day';
    const searchInp = document.getElementById('full-wo-search');
    if (searchInp) searchInp.value = '';
    renderFullWoPickerList('');
    openModal('modal-full-wo-list');
  });

  // Trigger buka Full WO List Modal dari Input Manual
  document.getElementById('btn-trigger-manual-wo')?.addEventListener('click', () => {
    activeWoPickerTarget = 'manual';
    const searchInp = document.getElementById('full-wo-search');
    if (searchInp) searchInp.value = '';
    renderFullWoPickerList('');
    openModal('modal-full-wo-list');
  });

  document.getElementById('btn-back-full-wo')?.addEventListener('click', () => {
    closeModal('modal-full-wo-list');
  });

  document.getElementById('btn-close-full-wo')?.addEventListener('click', () => {
    closeModal('modal-full-wo-list');
  });

  document.getElementById('full-wo-search')?.addEventListener('input', (e) => {
    renderFullWoPickerList(e.target.value);
  });

  // Swipe gesture untuk menutup Modal Full WO List
  const fullWoSheet = document.querySelector('#modal-full-wo-list .modal-sheet');
  if (fullWoSheet) {
    let touchStartX = 0, touchStartY = 0, touchDeltaX = 0, touchDeltaY = 0;
    fullWoSheet.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchDeltaX = 0;
      touchDeltaY = 0;
    }, { passive: true });
    fullWoSheet.addEventListener('touchmove', (e) => {
      touchDeltaX = e.touches[0].clientX - touchStartX;
      touchDeltaY = e.touches[0].clientY - touchStartY;
    }, { passive: true });
    fullWoSheet.addEventListener('touchend', () => {
      if (Math.abs(touchDeltaX) > 75 && Math.abs(touchDeltaX) > Math.abs(touchDeltaY) * 1.3) {
        closeModal('modal-full-wo-list');
      }
    }, { passive: true });
  }

  // Swipe gesture (slide ke kanan atau ke kiri) untuk menutup modal Atur Work Order
  const editWoSheet = document.querySelector('#modal-edit-wo .modal-sheet');
  if (editWoSheet) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDeltaX = 0;
    let touchDeltaY = 0;

    editWoSheet.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchDeltaX = 0;
      touchDeltaY = 0;
    }, { passive: true });

    editWoSheet.addEventListener('touchmove', (e) => {
      touchDeltaX = e.touches[0].clientX - touchStartX;
      touchDeltaY = e.touches[0].clientY - touchStartY;
    }, { passive: true });

    editWoSheet.addEventListener('touchend', () => {
      // Jika geser horizontal lebih dari 75px dan lebih dominan dibanding geser vertikal
      if (Math.abs(touchDeltaX) > 75 && Math.abs(touchDeltaX) > Math.abs(touchDeltaY) * 1.3) {
        closeEditWo();
      }
    }, { passive: true });
  }

  document.getElementById('btn-save-edit-wo').onclick = async () => {
    if (!activeEditingDayId) return;

    const saveBtn = document.getElementById('btn-save-edit-wo');
    const oldText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Menyimpan...';
    }

    try {
      const res = await fetch(`/api/daily-plan/${activeEditingDayId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wo_number: document.getElementById('input-wo-number').value.trim(),
          customer: document.getElementById('input-wo-customer').value.trim(),
          job_description: document.getElementById('input-wo-desc').value.trim(),
          upd_amount: parseInt(document.getElementById('input-wo-upd').value)
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        alert('Gagal update WO harian: ' + (errJson.error || res.statusText));
        return;
      }

      closeModal('modal-edit-wo');
      await loadStDetail(currentSt.id);
    } catch (err) {
      console.error('Error save edit wo:', err);
      alert('Terjadi kesalahan koneksi saat menyimpan WO.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = oldText;
      }
    }
  };

  // Split Modal
  document.getElementById('nav-tab-split').onclick = () => {
    renderSplitDaysList();
    document.getElementById('split-total').value = '';
    document.getElementById('split-file').value = '';
    openModal('modal-split');
  };

  document.getElementById('btn-cancel-split').onclick = () => closeModal('modal-split');

  document.getElementById('btn-save-split').onclick = async () => {
    const cat = document.getElementById('split-cat').value;
    const totalAmount = parseInt(document.getElementById('split-total').value) || 0;
    const checkedBoxes = document.querySelectorAll('.split-day-box:checked');

    if (totalAmount <= 0) {
      alert('Masukkan nominal total kuitansi asli');
      return;
    }
    if (checkedBoxes.length === 0) {
      alert('Pilih minimal 1 tanggal pembebanan');
      return;
    }

    const perDay = Math.round(totalAmount / checkedBoxes.length);
    const splits = [];

    checkedBoxes.forEach(cb => {
      const dayId = parseInt(cb.dataset.dayId);
      const day = currentDays.find(d => d.id === dayId);
      const customWoInp = document.querySelector(`input[data-split-wo-for="${dayId}"]`);
      const assignedWo = customWoInp ? customWoInp.value.trim() : (day ? (day.wo_number || '') : '');

      splits.push({
        daily_plan_id: day ? day.id : null,
        date: cb.dataset.date,
        amount: perDay,
        wo_number: assignedWo,
        keterangan: `Split ${cat} (${checkedBoxes.length} hari)`
      });
    });

    const formData = new FormData();
    formData.append('st_id', currentSt.id);
    formData.append('category', cat);
    formData.append('splits_json', JSON.stringify(splits));
    formData.append('keterangan', `Split ${cat} total ${fmtRp(totalAmount)}`);

    const splitFileInput = document.getElementById('split-file');
    if (splitFileInput.files.length > 0) {
      formData.append('receipt', splitFileInput.files[0]);
    }

    await fetch('/api/expenses/split', { method: 'POST', body: formData });
    closeModal('modal-split');
    await loadStDetail(currentSt.id);
  };

  // Rekap WO Modal
  document.getElementById('nav-tab-rekap').onclick = async () => {
    openModal('modal-rekap');
    const res = await fetch(`/api/st/${currentSt.id}/analysis`);
    const data = await res.json();
    const container = document.getElementById('rekap-wo-list');
    container.innerHTML = '';

    if (data.by_wo.length === 0) {
      container.innerHTML = '<div style="padding:16px; color:var(--muted); text-align:center;">Belum ada beban tercatat.</div>';
      return;
    }

    data.by_wo.forEach(item => {
      const row = document.createElement('div');
      row.className = 'tx-item';
      row.innerHTML = `
        <div class="tx-left">
          <div class="tx-icon-box" style="background:#fef3c7; color:#b45309;">🛠️</div>
          <div>
            <div class="tx-name">${item.wo}</div>
            <div class="tx-desc">${item.count_items} item pengeluaran</div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-val">${fmtRp(item.total_amount)}</div>
        </div>
      `;
      container.appendChild(row);
    });
  };

  // Ekspor Excel / CSV
  document.getElementById('nav-tab-export')?.addEventListener('click', () => {
    if (!currentSt) return;
    window.location.href = `/api/st/${currentSt.id}/export-csv`;
  });

  document.getElementById('btn-close-rekap').onclick = () => closeModal('modal-rekap');

  // Event Listeners untuk Form Edit Pengeluaran Modern
  const amountDisplay = document.getElementById('edit-exp-amount-display');
  const amountHidden = document.getElementById('edit-exp-amount');

  if (amountDisplay && amountHidden) {
    amountDisplay.addEventListener('input', (e) => {
      const rawNum = e.target.value.replace(/\D/g, '');
      amountHidden.value = rawNum || '0';
      e.target.value = formatNumberInputWithDots(rawNum);
    });
  }

  // Pilih Kategori via Chips
  document.querySelectorAll('.edit-cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      setEditExpCategory(chip.dataset.cat);
    });
  });

  // Pilih Tanggal via Kalender dari Edit Expense
  document.getElementById('btn-edit-exp-open-date')?.addEventListener('click', () => {
    const curDate = document.getElementById('edit-exp-date')?.value;
    if (curDate) {
      const d = new Date(curDate);
      calendarViewYear = d.getFullYear();
      calendarViewMonth = d.getMonth();
    }
    // Ganti target kalender ke modal edit expense
    datePickerTarget = 'edit-expense';
    renderInteractiveDatePicker();
    openModal('modal-date-picker');
  });

  // Upload Foto Nota di Edit Expense (Kamera vs Galeri)
  const editFileCamera = document.getElementById('edit-exp-file-camera');
  const editFileGallery = document.getElementById('edit-exp-file-gallery');
  const editNotaBoxText = document.getElementById('edit-exp-current-nota');
  const editNotaImg = document.getElementById('edit-exp-img-preview');

  const handleEditNotaFileSelected = (file, src) => {
    if (!file) return;
    editExpSelectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      editNotaImg.style.display = 'block';
      editNotaImg.src = e.target.result;
      editNotaBoxText.innerHTML = `Foto Baru (${src}): <strong>${file.name}</strong>`;
    };
    reader.readAsDataURL(file);
  };

  document.getElementById('btn-edit-nota-camera')?.addEventListener('click', () => editFileCamera?.click());
  document.getElementById('btn-edit-nota-gallery')?.addEventListener('click', () => editFileGallery?.click());

  editFileCamera?.addEventListener('change', () => {
    if (editFileCamera.files.length > 0) handleEditNotaFileSelected(editFileCamera.files[0], 'Kamera');
  });

  editFileGallery?.addEventListener('change', () => {
    if (editFileGallery.files.length > 0) handleEditNotaFileSelected(editFileGallery.files[0], 'Galeri');
  });

  // Trigger WO Selector di Modal Edit Expense
  document.getElementById('btn-trigger-edit-wo-picker')?.addEventListener('click', () => {
    activeWoPickerTarget = 'edit-expense';
    const searchInp = document.getElementById('full-wo-search');
    if (searchInp) searchInp.value = '';
    renderFullWoPickerList('');
    openModal('modal-full-wo-list');
  });

  // Saat tanggal di Edit Expense diganti, update otomatis default hint WO
  document.getElementById('edit-exp-date')?.addEventListener('change', (e) => {
    const curVal = document.getElementById('edit-exp-wo')?.value;
    const day = currentDays.find(d => d.date === e.target.value);
    const defaultWo = day ? (day.wo_number || '') : '';
    if (!curVal) {
      updateEditExpWoCard(defaultWo, false);
    } else {
      updateEditExpWoCard(curVal, true);
    }
  });

  // Edit Expense Save & Delete
  document.getElementById('btn-cancel-edit-expense').onclick = () => closeModal('modal-edit-expense');

  document.getElementById('btn-save-edit-expense').onclick = async () => {
    if (!activeEditingExpenseId) return;

    const amount = document.getElementById('edit-exp-amount').value;
    if (!amount || parseInt(amount) <= 0) {
      alert('Masukkan nominal yang valid');
      return;
    }

    const saveBtn = document.getElementById('btn-save-edit-expense');
    const oldBtnText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Menyimpan...';
    }

    try {
      const formData = new FormData();
      formData.append('date', document.getElementById('edit-exp-date').value);
      formData.append('category', document.getElementById('edit-exp-cat').value);
      formData.append('amount', amount);
      formData.append('wo_number', document.getElementById('edit-exp-wo').value.trim());
      formData.append('keterangan', document.getElementById('edit-exp-notes').value.trim());
      formData.append('st_id', document.getElementById('edit-exp-st-select')?.value || '');

      if (editExpSelectedFile) {
        formData.append('receipt', editExpSelectedFile);
      }

      const res = await fetch(`/api/expenses/${activeEditingExpenseId}`, {
        method: 'PUT',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        alert('Gagal menyimpan perubahan: ' + (errJson.error || res.statusText));
        return;
      }

      closeModal('modal-edit-expense');
      if (currentSt) {
        await loadStDetail(currentSt.id);
      }
      await checkUnassignedExpenses();
    } catch (err) {
      console.error('Error save edit expense:', err);
      alert('Terjadi kesalahan koneksi saat menyimpan pengeluaran.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = oldBtnText;
      }
    }
  };

  document.getElementById('btn-delete-expense').onclick = async () => {
    if (!activeEditingExpenseId) return;
    if (!confirm('Apakah Anda yakin ingin menghapus pengeluaran ini?')) return;

    await fetch(`/api/expenses/${activeEditingExpenseId}`, {
      method: 'DELETE'
    });

    closeModal('modal-edit-expense');
    await loadStDetail(currentSt.id);
  };

  // Deklarasi Button
  document.getElementById('btn-deklarasi-action').onclick = () => {
    alert(`🚀 Siap Mengisi Deklarasi!\nSeluruh ${currentDays.length} hari dinas pada ST ${currentSt.st_number} beserta nota kuitansi dan pembebanan WO siap dikirim ke web Bitrix Bina Pertiwi.`);
  };

  // Staging Area Handlers
  document.getElementById('btn-open-staging-modal')?.addEventListener('click', openStagingModal);
  document.getElementById('btn-close-staging')?.addEventListener('click', () => closeModal('modal-staging'));
  document.getElementById('btn-submit-staging-assign')?.addEventListener('click', submitStagingAssign);

  // Sync WO & ST Bina Pertiwi Handlers
  let isBpLoggedIn = false;
  const btnSyncBp = document.getElementById('btn-sync-bp');
  if (btnSyncBp) {
    btnSyncBp.onclick = async () => {
      openModal('modal-bp-sync');
      const statusBox = document.getElementById('bp-sync-status');
      statusBox.style.display = 'none';

      const connectedCard = document.getElementById('bp-connected-card');
      const credForm = document.getElementById('bp-credentials-form');
      const connectedName = document.getElementById('bp-connected-name');
      const badge = document.getElementById('bp-account-badge');

      try {
        const res = await fetch('/api/user/bp-account');
        const user = await res.json();
        if (user.bp_login) {
          isBpLoggedIn = true;
          document.getElementById('bp-sync-username').value = user.bp_login;
          if (connectedCard && credForm) {
            connectedCard.style.display = 'block';
            credForm.style.display = 'none'; // Sembunyikan form input login jika sudah tersimpan
            // Tampilkan nama profil sebenarnya dari portal BP jika ada
            const displayName = user.fullname && user.fullname !== 'Mekanik Lapangan' 
              ? user.fullname 
              : (user.nrp || user.bp_login);
            connectedName.textContent = user.nrp && user.fullname && user.fullname !== 'Mekanik Lapangan'
              ? `${displayName} (${user.nrp})`
              : displayName;
            badge.textContent = 'Siap Sync';
            badge.style.background = '#dcfce7';
            badge.style.color = '#15803d';
          }
        } else {
          isBpLoggedIn = false;
          if (connectedCard && credForm) {
            connectedCard.style.display = 'none';
            credForm.style.display = 'block';
          }
        }
      } catch (err) {}
    };
  }

  // Toggle Ubah Akun jika ingin ganti password/login
  const btnToggleBp = document.getElementById('btn-toggle-bp-edit');
  if (btnToggleBp) {
    btnToggleBp.onclick = () => {
      const credForm = document.getElementById('bp-credentials-form');
      if (credForm) {
        credForm.style.display = credForm.style.display === 'none' ? 'block' : 'none';
        btnToggleBp.textContent = credForm.style.display === 'none' ? 'Ganti' : 'Batal Ubah';
      }
    };
  }

  // Toggle Lihat/Sembunyikan Password BP
  const btnToggleBpPass = document.getElementById('btn-toggle-bp-password');
  const bpPassInput = document.getElementById('bp-sync-password');
  if (btnToggleBpPass && bpPassInput) {
    btnToggleBpPass.onclick = () => {
      if (bpPassInput.type === 'password') {
        bpPassInput.type = 'text';
        btnToggleBpPass.innerText = '🙈';
        btnToggleBpPass.title = 'Sembunyikan Password';
      } else {
        bpPassInput.type = 'password';
        btnToggleBpPass.innerText = '👁️';
        btnToggleBpPass.title = 'Lihat Password';
      }
    };
  }

  document.getElementById('btn-close-bp-sync').onclick = () => {
    closeModal('modal-bp-sync');
  };

  document.getElementById('btn-do-bp-sync').onclick = async () => {
    const usernameInput = document.getElementById('bp-sync-username').value.trim();
    const passwordInput = document.getElementById('bp-sync-password').value;
    const statusBox = document.getElementById('bp-sync-status');
    const syncBtn = document.getElementById('btn-do-bp-sync');

    syncBtn.disabled = true;
    syncBtn.innerText = '⏳ Menghubungkan ke BP...';
    statusBox.style.display = 'block';
    statusBox.style.background = '#e0f2fe';
    statusBox.style.color = '#0369a1';
    statusBox.innerText = 'Memeriksa sesi login & mengambil data ST dan WO...';

    try {
      // Simpan password baru jika diinputkan
      if (passwordInput && usernameInput) {
        await fetch('/api/user/bp-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bp_login: usernameInput, bp_password: passwordInput })
        });
      }

      // Sync data menggunakan sesi tersimpan di server
      const payload = {};
      if (usernameInput) payload.bp_login = usernameInput;
      if (passwordInput) payload.bp_password = passwordInput;

      const res = await fetch('/api/wo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        // Jika error autentikasi, otomatis buka form agar user bisa input ulang password
        const credForm = document.getElementById('bp-credentials-form');
        const btnToggleBp = document.getElementById('btn-toggle-bp-edit');
        if (credForm) {
          credForm.style.display = 'block';
          if (btnToggleBp) btnToggleBp.textContent = 'Batal Ubah';
        }
        throw new Error(data.error || 'Gagal sinkronisasi');
      }

      statusBox.style.background = '#dcfce7';
      statusBox.style.color = '#15803d';
      statusBox.innerText = `✅ ${data.message || 'Sinkronisasi berhasil!'}`;

      // Refresh master cache WO & ST
      try {
        const woRes = await fetch('/api/wo?include_closed=true');
        allMasterWos = await woRes.json();
      } catch(e) {}

      // Refresh data tampilan
      if (currentSt) {
        await loadStDetail(currentSt.id);
      } else {
        await loadInitialData();
      }

      setTimeout(() => {
        closeModal('modal-bp-sync');
      }, 1500);

    } catch (err) {
      statusBox.style.background = '#fee2e2';
      statusBox.style.color = '#dc2626';
      statusBox.innerText = `❌ Error: ${err.message}`;
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerText = '🚀 Mulai Tarik Data';
    }
  };
}

let cachedStPickerList = [];
let currentStFilter = 'active';

window.filterStPicker = function(filter) {
  currentStFilter = filter;
  ['active', 'declared', 'all'].forEach(tab => {
    const btn = document.getElementById(`tab-st-${tab}`);
    if (btn) {
      if (tab === filter) {
        btn.style.background = '#fff';
        btn.style.color = '#0f172a';
        btn.style.fontWeight = '750';
        btn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#64748b';
        btn.style.fontWeight = '700';
        btn.style.boxShadow = 'none';
      }
    }
  });

  renderStPickerList(cachedStPickerList);
};

function renderStPickerList(sts) {
  cachedStPickerList = sts || [];
  const container = document.getElementById('st-picker-list');
  const countLabel = document.getElementById('st-picker-count');
  if (!container) return;

  // Filter ST berdasarkan status deklarasi portal BP
  const filteredSts = cachedStPickerList.filter(st => {
    const rawStatus = (st.status || '').toUpperCase();
    const isDeclared = rawStatus.includes('APPROVED') || rawStatus.includes('CONFIRMED') || rawStatus.includes('COMPLETED') || rawStatus === 'CLOSED';
    if (currentStFilter === 'active') return !isDeclared;
    if (currentStFilter === 'declared') return isDeclared;
    return true; // 'all'
  });

  if (countLabel) countLabel.textContent = `${filteredSts.length} ST`;

  if (filteredSts.length === 0) {
    let emptyMsg = 'Belum ada Surat Tugas tersimpan.';
    if (currentStFilter === 'active') emptyMsg = 'Semua Surat Tugas sudah selesai dideklarasikan.';
    if (currentStFilter === 'declared') emptyMsg = 'Belum ada ST yang selesai deklarasi.';
    container.innerHTML = `
      <div style="padding:24px 16px; text-align:center; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:14px; margin:8px 0;">
        <div style="font-size:28px; margin-bottom:8px;">📭</div>
        <div style="font-weight:750; font-size:13px; color:#334155; margin-bottom:4px;">${emptyMsg}</div>
        <div style="color:var(--muted); font-size:11.5px; line-height:1.4;">Klik tab "Semua" atau gunakan tombol "Tarik WO" untuk mengambil data terbaru dari BP.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredSts.map(st => {
    const isCurrent = currentSt && currentSt.id === st.id;
    const rawStatus = (st.status || '').toUpperCase();
    const isDeclared = rawStatus.includes('APPROVED') || rawStatus.includes('CONFIRMED') || rawStatus.includes('COMPLETED') || rawStatus === 'CLOSED';

    const statusBadge = isDeclared 
      ? '<span style="font-size:10px; background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:2px 7px; border-radius:8px; font-weight:800;">✅ SUDAH DEKLARASI</span>'
      : '<span style="font-size:10px; background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:2px 7px; border-radius:8px; font-weight:800;">⏳ BELUM SELESAI</span>';

    return `
      <div onclick="selectActiveSt(${st.id})" 
           style="position:relative; border:${isCurrent ? '2px solid #0284c7' : '1px solid #e2e8f0'}; 
                  background:${isCurrent ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' : '#ffffff'}; 
                  border-radius:14px; padding:12px 14px; cursor:pointer; display:flex; flex-direction:column; gap:6px; 
                  box-shadow:${isCurrent ? '0 4px 14px rgba(2, 132, 199, 0.15)' : '0 2px 6px rgba(0,0,0,0.03)'};
                  transition:all 0.15s ease;">
        
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:850; font-size:13px; color:${isCurrent ? '#0369a1' : '#0f172a'}; letter-spacing:-0.2px;">${st.st_number}</span>
            ${statusBadge}
          </div>
          ${isCurrent 
            ? '<span style="font-size:10px; background:#0284c7; color:#ffffff; padding:2px 8px; border-radius:10px; font-weight:800; letter-spacing:0.3px;">AKTIF</span>' 
            : '<span style="font-size:11px; color:#64748b; font-weight:600;">Pilih ➔</span>'}
        </div>

        <div style="font-size:13px; font-weight:700; color:#1e293b; line-height:1.35;">${st.title || 'Dinas Lapangan'}</div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; padding-top:6px; border-top:1px solid ${isCurrent ? '#bae6fd' : '#f1f5f9'}; font-size:11.5px; color:${isCurrent ? '#0369a1' : 'var(--muted)'};">
          <span style="display:flex; align-items:center; gap:4px;">
            <span>📅</span> ${st.start_date || '-'} s/d ${st.end_date || '-'}
          </span>
          <span style="font-weight:750; background:${isCurrent ? '#bae6fd' : '#f1f5f9'}; padding:2px 7px; border-radius:6px;">
            ⏱️ ${st.total_days || 0} Hari
          </span>
        </div>
      </div>
    `;
  }).join('');
}

window.selectActiveSt = async function(stId) {
  closeModal('modal-st-picker');
  await loadStDetail(stId);
};

function applySelectedWoToSplitDay(dayId, woNum) {
  const inp = document.querySelector(`input[data-split-wo-for="${dayId}"]`);
  const label = document.querySelector(`span[data-split-wo-label-for="${dayId}"]`);
  if (inp) inp.value = woNum || '';
  if (label) {
    if (woNum) {
      label.innerHTML = `<span style="color:var(--bp-orange-dark); font-weight:850;">${woNum}</span>`;
    } else {
      label.innerHTML = `<span style="color:var(--muted); font-style:italic;">Tanpa WO</span>`;
    }
  }
}

function renderSplitDaysList() {
  const container = document.getElementById('split-days-container');
  if (!container) return;
  container.innerHTML = '';

  const totalInput = document.getElementById('split-total');
  const updateSplitCalc = () => {
    const totalAmount = parseInt(totalInput?.value) || 0;
    const checkedBoxes = document.querySelectorAll('.split-day-box:checked');
    const daysCountEl = document.getElementById('split-summary-days');
    const perDayEl = document.getElementById('split-summary-perday');

    if (daysCountEl) daysCountEl.textContent = `${checkedBoxes.length} hari dipilih`;
    if (perDayEl) {
      const perDay = checkedBoxes.length > 0 ? Math.round(totalAmount / checkedBoxes.length) : 0;
      perDayEl.textContent = `${fmtRp(perDay)} / hari`;
    }
  };

  currentDays.forEach(day => {
    const d = new Date(day.date);
    const dayName = dayNamesShort[d.getDay()];
    const dateNum = d.getDate();
    const monthName = monthNamesShort[d.getMonth()];
    const defaultWo = day.wo_number || '';

    const card = document.createElement('div');
    card.className = 'split-day-card selected';
    card.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1.5px solid var(--bp-orange-border);
      background: var(--bp-orange-light);
      transition: all 0.15s ease;
      user-select: none;
    `;

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;">
          <input type="checkbox" class="split-day-box" data-day-id="${day.id}" data-date="${day.date}" checked 
                 style="width: 18px; height: 18px; accent-color: var(--bp-orange); cursor: pointer;" />
          <div>
            <div style="font-size: 13px; font-weight: 850; color: #1e293b;">
              ${dayName}, ${dateNum} ${monthName}
            </div>
            <div style="font-size: 10.5px; color: var(--muted); margin-top: 1px;">
              Beban Hari Ini
            </div>
          </div>
        </label>
        <span class="split-check-badge" style="font-size: 11px; font-weight: 800; color: var(--bp-orange-dark); background: #fed7aa; padding: 2px 7px; border-radius: 6px;">
          Terpilih
        </span>
      </div>

      <!-- Quick WO Picker Button per Hari -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: #ffffff; border-radius: 10px; border: 1px solid var(--line); margin-top: 2px;">
        <div style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; min-width: 0;">
          <span style="color: var(--muted); font-weight: 700;">WO:</span>
          <span data-split-wo-label-for="${day.id}" style="font-size: 12px; font-weight: 800; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${defaultWo ? `<span style="color:var(--bp-orange-dark);">${defaultWo}</span>` : '<span style="color:var(--muted); font-style:italic;">Tanpa WO</span>'}
          </span>
        </div>
        <button type="button" class="btn-change-split-wo" data-day-id="${day.id}" 
                style="border: 0; background: #eff6ff; color: #2563eb; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 6px; cursor: pointer;">
          Ganti WO ▾
        </button>
        <input type="hidden" class="split-day-wo-input" data-day-id="${day.id}" data-split-wo-for="${day.id}" value="${defaultWo}" />
      </div>
    `;

    const cb = card.querySelector('.split-day-box');
    const badge = card.querySelector('.split-check-badge');
    const btnChangeWo = card.querySelector('.btn-change-split-wo');

    btnChangeWo.onclick = (e) => {
      e.stopPropagation();
      activeWoPickerTarget = `split-day-${day.id}`;
      const searchInp = document.getElementById('full-wo-search');
      if (searchInp) searchInp.value = '';
      renderFullWoPickerList('');
      openModal('modal-full-wo-list');
    };

    const toggleCardState = () => {
      if (cb.checked) {
        card.style.border = '1.5px solid var(--bp-orange-border)';
        card.style.background = 'var(--bp-orange-light)';
        badge.textContent = 'Terpilih';
        badge.style.color = 'var(--bp-orange-dark)';
        badge.style.background = '#fed7aa';
      } else {
        card.style.border = '1px solid var(--line)';
        card.style.background = '#ffffff';
        badge.textContent = 'Lewati';
        badge.style.color = '#94a3b8';
        badge.style.background = '#f1f5f9';
      }
      updateSplitCalc();
    };

    cb.addEventListener('change', toggleCardState);
    container.appendChild(card);
  });

  if (totalInput) {
    totalInput.oninput = updateSplitCalc;
  }
  updateSplitCalc();

  // Tombol Select All / Unselect All
  document.getElementById('btn-split-select-all').onclick = () => {
    document.querySelectorAll('.split-day-box').forEach(cb => {
      cb.checked = true;
      cb.dispatchEvent(new Event('change'));
    });
  };

  document.getElementById('btn-split-unselect-all').onclick = () => {
    document.querySelectorAll('.split-day-box').forEach(cb => {
      cb.checked = false;
      cb.dispatchEvent(new Event('change'));
    });
  };
}

// ==========================================
// MODAL & GESTURE MANAGEMENT SYSTEM (SPA BACK / SWIPE)
// ==========================================
let openModalStack = [];

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  
  el.classList.add('open');
  if (!openModalStack.includes(id)) {
    openModalStack.push(id);
    // Push dummy state to browser history agar saat user swipe back / tekan tombol Back HP,
    // browser mentrigger popstate untuk menutup modal (bukan mundur URL aplikasi)
    window.history.pushState({ modalOpen: id }, '');
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.remove('open');
  const idx = openModalStack.indexOf(id);
  if (idx !== -1) {
    openModalStack.splice(idx, 1);
    // Jika masih ada history state dari modal ini, mundurkan history 1 langkah
    if (window.history.state && window.history.state.modalOpen === id) {
      window.history.back();
    }
  }
}

function closeTopModal() {
  if (openModalStack.length > 0) {
    const topId = openModalStack.pop();
    const el = document.getElementById(topId);
    if (el) el.classList.remove('open');
    return true;
  }
  return false;
}

// Global Popstate Handler: Back button / Edge-swipe gesture di Android & iOS
window.addEventListener('popstate', (e) => {
  if (openModalStack.length > 0) {
    // Tutup modal paling atas yang sedang terbuka
    const topId = openModalStack.pop();
    const el = document.getElementById(topId);
    if (el) el.classList.remove('open');
  }
});

// Setup Touch Swipe Dismissal untuk SEMUA Modal Sheet (Swipe Horizontal Kiri/Kanan & Swipe Vertikal ke Bawah)
function initGlobalModalSwipeGestures() {
  document.querySelectorAll('.modal-sheet').forEach(sheet => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDeltaX = 0;
    let touchDeltaY = 0;
    let startTime = 0;
    let isSwipeStartedOnDateGrid = false;

    sheet.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchDeltaX = 0;
      touchDeltaY = 0;
      startTime = Date.now();
      // Deteksi jika gesture dimulai dari area grid kalender tanggal
      isSwipeStartedOnDateGrid = Boolean(e.target.closest('#interactive-date-grid') || e.target.closest('#modal-date-picker .calendar-box'));
    }, { passive: true });

    sheet.addEventListener('touchmove', (e) => {
      touchDeltaX = e.touches[0].clientX - touchStartX;
      touchDeltaY = e.touches[0].clientY - touchStartY;
    }, { passive: true });

    sheet.addEventListener('touchend', (e) => {
      const elapsed = Date.now() - startTime;
      const absX = Math.abs(touchDeltaX);
      const absY = Math.abs(touchDeltaY);

      // Cari modal ID overlay-nya
      const overlay = sheet.closest('.modal-overlay');
      if (!overlay || !overlay.classList.contains('open')) return;

      const isHorizontalSwipe = absX > 50 && absX > absY * 1.2 && elapsed < 600;
      const isVerticalPullDown = touchDeltaY > 90 && touchStartY < (sheet.getBoundingClientRect().top + 80);

      // KASUS KHUSUS MODAL KALENDER:
      if (overlay.id === 'modal-date-picker') {
        const sheetRect = sheet.getBoundingClientRect();
        // Deteksi apakah swipe dimulai dari tepi layar (jarak < 45px dari sisi kiri/kanan sheet)
        const isEdgeSwipe = (touchStartX - sheetRect.left < 45) || (sheetRect.right - touchStartX < 45);

        // Jika swipe di area tanggal kalender (bukan tepi layar): GANTI BULAN
        if (isHorizontalSwipe && isSwipeStartedOnDateGrid && !isEdgeSwipe) {
          if (touchDeltaX < 0) {
            // Geser ke Kiri (Swipe Left) -> Bulan Berikutnya
            document.getElementById('btn-cal-next')?.click();
          } else {
            // Geser ke Kanan (Swipe Right) -> Bulan Sebelumnya
            document.getElementById('btn-cal-prev')?.click();
          }
          return;
        }

        // Jika swipe dari tepi layar atau pull down: KEMBALI / TUTUP MODAL
        if ((isHorizontalSwipe && isEdgeSwipe) || isVerticalPullDown) {
          closeModal(overlay.id);
        }
        return;
      }

      // MODAL LAINNYA: Default Swipe Dismissal
      if (isHorizontalSwipe || isVerticalPullDown) {
        closeModal(overlay.id);
      }
    }, { passive: true });
  });

  // Tap di area gelap overlay (luar sheet) untuk menutup modal
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });
}

// ==================== UNASSIGNED STAGING LOGIC (KOTAK TAMPUNG & SMART SUGGESTION) ====================
let unassignedExpensesList = [];
let stagingSelectedIds = new Set();

async function checkUnassignedExpenses() {
  const banner = document.getElementById('unassigned-staging-banner');
  const countBadge = document.getElementById('unassigned-badge-count');
  const bannerText = document.getElementById('unassigned-banner-text');
  if (!banner) return;

  try {
    const res = await fetch('/api/expenses?unassigned=true');
    unassignedExpensesList = await res.json();

    if (!unassignedExpensesList || unassignedExpensesList.length === 0) {
      banner.style.display = 'none';
      renderStHierarchy();
      return;
    }

    banner.style.display = 'block';
    if (countBadge) countBadge.textContent = `${unassignedExpensesList.length} Nota`;

    // Pastikan seksi staging di hierarki bawah juga direfresh
    renderStHierarchy();

    // Smart Suggestion: cek berapa nota yang pas dengan tanggal ST aktif
    if (currentSt && currentDays.length > 0) {
      const stDates = new Set(currentDays.map(d => d.date));
      const matchedCount = unassignedExpensesList.filter(e => stDates.has(e.date)).length;
      if (bannerText) {
        if (matchedCount > 0) {
          bannerText.innerHTML = `Ditemukan <strong>${matchedCount} nota</strong> yang tanggalnya cocok dengan periode ST aktif (${currentSt.st_number}).`;
        } else {
          bannerText.textContent = `Ada ${unassignedExpensesList.length} nota mandiri dicatat sebelum ST. Buka untuk menautkan.`;
        }
      }
    }
  } catch (err) {
    console.error('Error check unassigned expenses:', err);
  }
}

function openStagingModal() {
  const modal = document.getElementById('modal-staging');
  const targetLabel = document.getElementById('staging-target-st-name');
  const modalCount = document.getElementById('staging-modal-count');
  const container = document.getElementById('staging-item-list');
  const selectAllCb = document.getElementById('staging-select-all');

  if (!modal || !container) return;

  if (targetLabel) {
    targetLabel.textContent = currentSt ? `${currentSt.st_number} - ${currentSt.title}` : 'Tidak ada ST aktif';
  }
  if (modalCount) modalCount.textContent = `${unassignedExpensesList.length} Nota`;

  // Pre-select yang tanggalnya berada dalam ST aktif
  stagingSelectedIds.clear();
  const stDates = new Set(currentDays.map(d => d.date));

  unassignedExpensesList.forEach(item => {
    if (stDates.has(item.date)) {
      stagingSelectedIds.add(item.id);
    }
  });

  if (selectAllCb) {
    selectAllCb.checked = stagingSelectedIds.size > 0 && stagingSelectedIds.size === unassignedExpensesList.length;
    selectAllCb.onchange = (e) => {
      if (e.target.checked) {
        unassignedExpensesList.forEach(i => stagingSelectedIds.add(i.id));
      } else {
        stagingSelectedIds.clear();
      }
      renderStagingItems();
      updateStagingSum();
    };
  }

  renderStagingItems();
  updateStagingSum();
  openModal('modal-staging');
}

function renderStagingItems() {
  const container = document.getElementById('staging-item-list');
  if (!container) return;
  container.innerHTML = '';

  if (unassignedExpensesList.length === 0) {
    container.innerHTML = `
      <div style="padding:24px 16px; text-align:center; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:14px;">
        <div style="font-size:24px; margin-bottom:6px;">✨</div>
        <div style="font-weight:750; font-size:13px; color:#334155;">Tidak ada pengeluaran gantung</div>
        <div style="color:var(--muted); font-size:11.5px;">Semua pengeluaran sudah resmi tertaut ke Surat Tugas.</div>
      </div>
    `;
    return;
  }

  const stDates = new Set(currentDays.map(d => d.date));

  unassignedExpensesList.forEach(item => {
    const isChecked = stagingSelectedIds.has(item.id);
    const isMatchDate = stDates.has(item.date);
    const d = new Date(item.date);

    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1.5px solid ${isChecked ? '#f59e0b' : '#e2e8f0'};
      background: ${isChecked ? '#fffbeb' : '#ffffff'};
      cursor: pointer;
      transition: all 0.15s ease;
    `;

    row.onclick = (e) => {
      if (e.target.tagName !== 'INPUT') {
        if (stagingSelectedIds.has(item.id)) stagingSelectedIds.delete(item.id);
        else stagingSelectedIds.add(item.id);
        renderStagingItems();
        updateStagingSum();
      }
    };

    row.innerHTML = `
      <input type="checkbox" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; accent-color:#f59e0b; cursor:pointer;" />
      <div style="width:34px; height:34px; border-radius:10px; background:#fef3c7; color:#b45309; display:flex; align-items:center; justify-content:center; font-size:16px;">
        ${catIcons[item.category] || '💸'}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:13px; font-weight:800; color:#0f172a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${item.keterangan || item.category}
          </span>
          <span style="font-size:13px; font-weight:850; color:#b45309;">${fmtRp(item.amount)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px; font-size:11px; color:#64748b;">
          <span>📅 ${dayNamesShort[d.getDay()]}, ${d.getDate()} ${monthNamesShort[d.getMonth()]}</span>
          ${isMatchDate 
            ? '<span style="color:#15803d; font-weight:800; background:#dcfce7; padding:1px 6px; border-radius:6px;">✓ Cocok Periode</span>' 
            : '<span style="color:#b45309; font-weight:700; background:#fef3c7; padding:1px 6px; border-radius:6px;">Luar Periode</span>'}
        </div>
      </div>
    `;

    const cb = row.querySelector('input[type="checkbox"]');
    cb.onchange = () => {
      if (cb.checked) stagingSelectedIds.add(item.id);
      else stagingSelectedIds.delete(item.id);
      updateStagingSum();
      renderStagingItems();
    };

    container.appendChild(row);
  });
}

function updateStagingSum() {
  const sumEl = document.getElementById('staging-selected-sum');
  if (!sumEl) return;
  let total = 0;
  unassignedExpensesList.forEach(item => {
    if (stagingSelectedIds.has(item.id)) {
      total += item.amount;
    }
  });
  sumEl.textContent = `Terpilih (${stagingSelectedIds.size}): ${fmtRp(total)}`;
}

async function submitStagingAssign() {
  if (!currentSt) {
    alert('Pilih Surat Tugas tujuan terlebih dahulu.');
    return;
  }
  if (stagingSelectedIds.size === 0) {
    alert('Pilih minimal 1 pengeluaran yang ingin ditautkan ke ST ini.');
    return;
  }

  const confirmMsg = `Tautkan ${stagingSelectedIds.size} pengeluaran ke ST ${currentSt.st_number}?`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/expenses/assign-to-st', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        st_id: currentSt.id,
        expense_ids: Array.from(stagingSelectedIds)
      })
    });
    const result = await res.json();
    if (result.success) {
      closeModal('modal-staging');
      await loadStDetail(currentSt.id);
      await checkUnassignedExpenses();
    } else {
      alert('Gagal menautkan: ' + (result.error || 'Terjadi kesalahan'));
    }
  } catch (err) {
    console.error('Error submit staging assign:', err);
    alert('Terjadi kesalahan koneksi server.');
  }
}

// Inisialisasi gesture swipe saat DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlobalModalSwipeGestures);
} else {
  initGlobalModalSwipeGestures();
}

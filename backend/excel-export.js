import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { db } from './db.js';

export async function generateDeklarasiExcel(stId, outputPath) {
  const st = db.prepare('SELECT * FROM surat_tugas WHERE id = ?').get(stId);
  if (!st) throw new Error('Surat Tugas tidak ditemukan');

  const days = db.prepare(`
    SELECT * FROM daily_plans WHERE st_id = ? ORDER BY date ASC
  `).all(stId);

  const expenses = db.prepare(`
    SELECT * FROM expenses WHERE st_id = ? ORDER BY date ASC, id ASC
  `).all(stId);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Deklarasi');

  // Header Baris 1
  ws.getRow(1).values = [
    'Tanggal', 'UPD', 'Hotel', '', 'Tiket', '', 'Taxi', '', '', '', 'Fuel', 'Keterangan', 'No WO', 'TOTAL'
  ];

  // Header Baris 2
  ws.getRow(2).values = [
    '', '', 'Hotel', 'Laundry', 'Tiket', 'Wrapping', 'Cuci Mobil', 'Taxi', 'TOL', 'Parkir', '', '', '', ''
  ];

  // Map category to column index (1-based)
  // Col 1: Tanggal, 2: UPD, 3: Hotel, 4: Laundry, 5: Tiket, 6: Wrapping,
  // Col 7: Cuci Mobil, 8: Taxi, 9: TOL, 10: Parkir, 11: Fuel, 12: Keterangan, 13: No WO, 14: TOTAL
  const colMap = {
    'UPD': 2,
    'Hotel': 3,
    'Laundry': 4,
    'Tiket': 5,
    'Wrapping': 6,
    'Cuci Mobil': 7,
    'Taxi': 8,
    'TOL': 9,
    'Tol': 9,
    'Parkir': 10,
    'Fuel': 11,
    'BBM': 11
  };

  let rowIndex = 3;

  for (const day of days) {
    const dayExpenses = expenses.filter(e => e.date === day.date);

    // Kumpulkan nilai per kolom
    const rowVals = new Array(15).fill('');
    rowVals[1] = day.date; // Tanggal (YYYY-MM-DD)
    rowVals[2] = day.upd_amount || 0; // UPD harian
    rowVals[12] = day.job_description || (day.customer ? `${day.customer}` : '');
    rowVals[13] = day.wo_number || '';

    // Isi expenses ke kolom yang cocok
    for (const exp of dayExpenses) {
      const cIdx = colMap[exp.category];
      if (cIdx) {
        const cur = Number(rowVals[cIdx]) || 0;
        rowVals[cIdx] = cur + exp.amount;
      }
      // Jika di expense ada keterangan dan WO spesifik, lengkapi
      if (exp.wo_number && !rowVals[13]) rowVals[13] = exp.wo_number;
      if (exp.keterangan && !rowVals[12]) rowVals[12] = exp.keterangan;
    }

    const r = ws.getRow(rowIndex);
    r.values = rowVals;
    // Formula TOTAL di Col 14: =SUM(B{row}:K{row})
    r.getCell(14).value = { formula: `SUM(B${rowIndex}:K${rowIndex})` };

    rowIndex++;
  }

  // Format kolom & lebar
  ws.columns = [
    { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 14 }, { width: 35 }, { width: 16 }, { width: 15 }
  ];

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

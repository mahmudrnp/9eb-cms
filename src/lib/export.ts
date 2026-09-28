// Phase 13 — সাধারণীকৃত এক্সপোর্ট-ইউটিলিটি (CSV/Excel/PDF)
// PDF-জেনারেশন popup-window + window.print() প্যাটার্নে (Phase01 §১ — MT Tracker Pro রেফারেন্স-প্যাটার্ন)
import crestUrl from '../assets/charging-nine-crest.png';

export interface ExportColumn<T> {
  label: string;
  value: (row: T) => string | number;
}

function buildAOA<T>(data: T[], columns: ExportColumn<T>[]): (string | number)[][] {
  const header = columns.map((c) => c.label);
  const rows = data.map((row) => columns.map((c) => c.value(row)));
  return [header, ...rows];
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportToCSV<T>(filename: string, data: T[], columns: ExportColumn<T>[]) {
  const aoa = buildAOA(data, columns);
  const csv = aoa.map((row) => row.map(csvEscape).join(',')).join('\n');
  // BOM যোগ করা হলো যাতে Excel-এ বাংলা টেক্সট সঠিকভাবে দেখায়
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportToExcel<T>(filename: string, sheetName: string, data: T[], columns: ExportColumn<T>[]) {
  const XLSX = await import('xlsx'); // ⚠️ lazy-load — মোবাইল-ফার্স্ট বান্ডল-সাইজ ছোট রাখতে, Excel-এক্সপোর্ট চাপার আগে লোড হয় না
  const aoa = buildAOA(data, columns);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Phase03 রিভিশন২ ব্র্যান্ড-নিয়ম: প্রতিটা এক্সপোর্টেড ডকুমেন্টে ক্রেস্ট-লেটারহেড
export function printReport<T>(title: string, subtitle: string, data: T[], columns: ExportColumn<T>[]) {
  const aoa = buildAOA(data, columns);
  const [header, ...rows] = aoa;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;

  const tableHead = `<tr>${header.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  const tableBody = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('');

  win.document.write(`
    <!doctype html>
    <html lang="bn">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=IBM+Plex+Sans:wght@400;600&display=swap');
        body { font-family: 'Hind Siliguri', sans-serif; color: #14110F; margin: 24px; }
        header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #14432A; padding-bottom: 12px; margin-bottom: 16px; }
        header img { height: 48px; width: 48px; }
        header h1 { font-size: 16px; margin: 0; }
        header p { font-size: 12px; margin: 2px 0 0; color: #4A5A62; }
        h2 { font-size: 14px; margin: 0 0 4px; }
        .meta { font-size: 11px; color: #4A5A62; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #14432A; color: #fff; text-align: left; padding: 6px 8px; }
        td { padding: 6px 8px; border-bottom: 1px solid #E4E4E1; font-family: 'IBM Plex Sans', sans-serif; }
        tr:nth-child(even) td { background: #F9FAF8; }
        @media print { body { margin: 8mm; } }
      </style>
    </head>
    <body>
      <header>
        <img src="${crestUrl}" alt="crest" />
        <div>
          <h1>৯ ইস্ট বেঙ্গল রেজিমেন্ট — ক্যান্টিন ব্যবস্থাপনা</h1>
          <p>${title}</p>
        </div>
      </header>
      <h2>${title}</h2>
      <p class="meta">${subtitle} · জেনারেট: ${new Date().toLocaleString('bn-BD')}</p>
      <table>
        <thead>${tableHead}</thead>
        <tbody>${tableBody}</tbody>
      </table>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `);
  win.document.close();
}

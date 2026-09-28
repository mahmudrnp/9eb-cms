import { exportToCSV, exportToExcel, printReport, type ExportColumn } from '../lib/export';
import { logExportEvent } from '../lib/audit';

interface ExportBarProps<T> {
  filename: string;
  title: string;
  subtitle: string;
  data: T[];
  columns: ExportColumn<T>[];
}

export function ExportBar<T>({ filename, title, subtitle, data, columns }: ExportBarProps<T>) {
  const disabled = data.length === 0;

  // Phase14: প্রতিটা রিপোর্ট-এক্সপোর্ট অডিট-লগড (Phase01 §১৩ — "Report export")।
  // লগিং ব্যর্থ হলেও (অফলাইন ইত্যাদি) এক্সপোর্ট নিজে কখনো ব্লক হবে না।
  function handleExport(format: 'csv' | 'excel' | 'pdf', action: () => void) {
    action();
    void logExportEvent({ reportName: filename, format, rowCount: data.length });
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={disabled}
        onClick={() => handleExport('csv', () => exportToCSV(filename, data, columns))}
        className="rounded-[var(--radius-control)] border border-steel/40 px-3 py-1.5 text-xs font-medium text-ink hover:bg-steel/10 disabled:opacity-40"
      >
        CSV
      </button>
      <button
        disabled={disabled}
        onClick={() => handleExport('excel', () => exportToExcel(filename, title, data, columns))}
        className="rounded-[var(--radius-control)] border border-steel/40 px-3 py-1.5 text-xs font-medium text-ink hover:bg-steel/10 disabled:opacity-40"
      >
        Excel
      </button>
      <button
        disabled={disabled}
        onClick={() => handleExport('pdf', () => printReport(title, subtitle, data, columns))}
        className="rounded-[var(--radius-control)] border border-steel/40 px-3 py-1.5 text-xs font-medium text-ink hover:bg-steel/10 disabled:opacity-40"
      >
        PDF
      </button>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { parseSpreadsheetFile, importPurchasesFromRows, downloadTemplate, type ImportRowResult } from '../../lib/bulkImport';

export function PurchaseBulkImportPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResults(null);
    setFileName(file.name);
    try {
      const parsed = await parseSpreadsheetFile(file);
      setRows(parsed);
    } catch {
      setError('ফাইল পড়া যায়নি — .csv অথবা .xlsx ফাইল আপলোড করুন।');
    }
  }

  async function handleImport() {
    setImporting(true);
    setProgress({ done: 0, total: rows.length });
    const res = await importPurchasesFromRows(rows, (done, total) => setProgress({ done, total }));
    setResults(res);
    setImporting(false);
  }

  const successCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = results ? results.length - successCount : 0;

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">ক্রয় বাল্ক-আমদানি</h1>
      <p className="mb-5 text-sm text-steel">
        সব মালামাল কেনার পর একবারে CSV/Excel থেকে এন্ট্রি দিন। কলাম-ক্রম: সরবরাহকারী, ইনভয়েস, তারিখ, পণ্য, পরিমাণ, একক_মূল্য, মেয়াদ (ঐচ্ছিক), পেমেন্ট_স্ট্যাটাস (ঐচ্ছিক)।
        একই সরবরাহকারী+ইনভয়েস+তারিখের একাধিক সারি একটা ক্রয়-এন্ট্রিতে (একাধিক পণ্য-লাইন) স্বয়ংক্রিয়ভাবে গ্রুপ হবে। পণ্যের নাম বিদ্যমান পণ্য-তালিকার সাথে হুবহু মিলতে হবে।
      </p>

      <button onClick={() => downloadTemplate('purchases')} className="mb-4 text-sm font-medium text-navy underline">
        নমুনা টেমপ্লেট ডাউনলোড করুন
      </button>

      <div className="mb-5 rounded-[var(--radius-card)] border border-dashed border-steel/40 bg-white p-5 text-center">
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="mx-auto block text-sm" />
        {fileName && <p className="mt-2 text-xs text-steel">{fileName} — {rows.length}টা সারি পাওয়া গেছে</p>}
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {rows.length > 0 && !results && (
        <>
          <div className="mb-4 overflow-x-auto rounded-[var(--radius-card)] border border-steel/20">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-navy text-left text-white">
                  {Object.keys(rows[0]).map((h) => (
                    <th key={h} className="px-2 py-1.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t border-steel/10">
                    {Object.values(r).map((v, j) => (
                      <td key={j} className="px-2 py-1.5 text-steel">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 10 && <p className="mb-3 text-xs text-steel">…আরও {rows.length - 10}টা সারি (প্রিভিউতে দেখানো হয়নি)</p>}

          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-[var(--radius-control)] bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-hover disabled:opacity-50"
          >
            {importing ? `আমদানি হচ্ছে… (${progress.done}/${progress.total})` : `${rows.length}টা সারি আমদানি করুন`}
          </button>
        </>
      )}

      {results && (
        <div>
          <p className="mb-3 text-sm">
            <span className="font-medium text-success">{successCount}টা সফল</span>
            {failCount > 0 && <span className="ml-3 font-medium text-danger">{failCount}টা ব্যর্থ</span>}
          </p>
          {failCount > 0 && (
            <div className="mb-4 max-h-64 overflow-y-auto rounded-[var(--radius-card)] border border-danger/30 bg-danger/5 p-3 text-xs">
              {results.filter((r) => !r.ok).map((r) => (
                <p key={r.rowIndex} className="text-danger">সারি {r.rowIndex + 2}: {r.message}</p>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/purchases')} className="rounded-[var(--radius-control)] bg-navy px-4 py-2.5 text-sm font-medium text-white">
            ক্রয়-তালিকায় ফিরে যান
          </button>
        </div>
      )}
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { ExportBar } from '../../components/ExportBar';
import { fetchStockMovement, type StockMovementRow } from '../../lib/inventory';
import type { StockTxnType } from '../../types/database.types';

const txnTypeLabel: Record<StockTxnType, string> = {
  purchase_in: 'ক্রয়-ইন',
  sale_out: 'বিক্রয়-আউট',
  adjustment: 'সমন্বয়',
  damage: 'ক্ষতিগ্রস্ত',
  expired: 'মেয়াদোত্তীর্ণ',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function StockMovementPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchStockMovement(startDate || undefined, endDate || undefined));
    } catch {
      setError('তথ্য লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">স্টক মুভমেন্ট রিপোর্ট</h1>
      <p className="mb-5 text-sm text-steel">সব পণ্যের স্টক-ইন/আউট/সমন্বয়/ক্ষতিগ্রস্ত/মেয়াদোত্তীর্ণ লেনদেন (সাম্প্রতিক ৫০০টা)</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy" />
        <span className="text-steel">থেকে</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy" />
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}

      {!loading && rows.length > 0 && (
        <div className="mb-3">
          <ExportBar
            filename="stock-movement-report"
            title="স্টক মুভমেন্ট রিপোর্ট"
            subtitle={`${rows.length}টা লেনদেন`}
            data={rows}
            columns={[
              { label: 'তারিখ', value: (r) => formatDate(r.txn_date) },
              { label: 'পণ্য', value: (r) => r.product_name },
              { label: 'ধরন', value: (r) => txnTypeLabel[r.txn_type] },
              { label: 'পরিমাণ', value: (r) => r.quantity },
              { label: 'একক', value: (r) => r.unit },
              { label: 'কারণ', value: (r) => r.reason ?? '' },
            ]}
          />
        </div>
      )}

      {!loading && rows.length === 0 && <p className="text-sm text-steel">এই সময়সীমায় কোনো স্টক-লেনদেন নেই।</p>}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-steel/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-white">
                <th className="px-3 py-2 font-medium">তারিখ</th>
                <th className="px-3 py-2 font-medium">পণ্য</th>
                <th className="px-3 py-2 font-medium">ধরন</th>
                <th className="px-3 py-2 text-right font-medium">পরিমাণ</th>
                <th className="px-3 py-2 font-medium">কারণ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-steel/15">
                  <td className="px-3 py-2 font-data tabular-nums">{formatDate(r.txn_date)}</td>
                  <td className="px-3 py-2">{r.product_name}</td>
                  <td className="px-3 py-2 text-steel">{txnTypeLabel[r.txn_type]}</td>
                  <td className={`px-3 py-2 text-right font-data tabular-nums ${r.quantity >= 0 ? 'text-success' : 'text-danger'}`}>
                    {r.quantity >= 0 ? '+' : ''}{r.quantity} {r.unit}
                  </td>
                  <td className="px-3 py-2 text-steel">{r.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}

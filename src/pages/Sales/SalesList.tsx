import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { fetchRecentSales } from '../../lib/sales';
import { ExportBar } from '../../components/ExportBar';
import type { SaleWithSoldier } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
const paymentLabel: Record<string, string> = { cash: 'নগদ', credit: 'বাকি', partial: 'আংশিক' };
const paymentColor: Record<string, string> = { cash: 'bg-success/10 text-success', credit: 'bg-danger/10 text-danger', partial: 'bg-warning/10 text-warning' };

export function SalesListPage() {
  const [sales, setSales] = useState<SaleWithSoldier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentSales().then(setSales).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">সাম্প্রতিক বিক্রয়</h1>
        <Link to="/pos" className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-navy-hover)]">
          + নতুন বিক্রয় (POS)
        </Link>
      </div>

      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}
      {!loading && sales.length === 0 && <p className="text-sm text-steel">এখনো কোনো বিক্রয় হয়নি।</p>}

      {!loading && sales.length > 0 && (
        <div className="mb-3">
          <ExportBar
            filename="sales-report"
            title="বিক্রয় রিপোর্ট"
            subtitle={`সাম্প্রতিক ${sales.length}টা বিক্রয়`}
            data={sales}
            columns={[
              { label: 'রসিদ', value: (s) => s.receipt_no },
              { label: 'তারিখ', value: (s) => formatDateTime(s.sale_date) },
              { label: 'সৈনিক', value: (s) => s.soldiers?.name ?? '' },
              { label: 'সার্ভিস#', value: (s) => s.soldiers?.service_id ?? '' },
              { label: 'সাবটোটাল', value: (s) => s.subtotal },
              { label: 'ডিসকাউন্ট', value: (s) => s.discount_amount },
              { label: 'মোট', value: (s) => s.total_amount },
              { label: 'পেমেন্ট-ধরন', value: (s) => paymentLabel[s.payment_type] },
              { label: 'পরিশোধিত', value: (s) => s.paid_amount },
            ]}
          />
        </div>
      )}

      {!loading && sales.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
          {sales.map((s, idx) => (
            <Link
              key={s.id}
              to={`/sales/${s.id}`}
              className={`flex items-center justify-between px-3 py-2.5 text-sm hover:bg-paper ${idx !== sales.length - 1 ? 'border-b border-steel/10' : ''}`}
            >
              <div>
                <p className="text-navy underline">{s.soldiers?.name ?? '—'}</p>
                <p className="text-xs text-steel">{s.receipt_no} · {formatDateTime(s.sale_date)}</p>
              </div>
              <div className="text-right">
                <p className="font-data tabular-nums text-ink">{formatTaka(s.total_amount)}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs ${paymentColor[s.payment_type]}`}>{paymentLabel[s.payment_type]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { fetchOutstandingSoldiers } from '../../lib/soldiers';
import { ExportBar } from '../../components/ExportBar';
import type { SoldierLedgerRow } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function CreditCollectionPage() {
  const [rows, setRows] = useState<SoldierLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOutstandingSoldiers()
      .then(setRows)
      .catch(() => setError('তথ্য লোড করা যায়নি।'))
      .finally(() => setLoading(false));
  }, []);

  const totalOutstanding = rows.reduce((sum, r) => sum + r.outstanding_balance, 0);

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">বকেয়া-আদায়</h1>
      <p className="mb-5 text-sm text-steel">যেসব সৈনিকের বকেয়া আছে, বেশি-থেকে-কম সাজানো (soldier_ledger থেকে লাইভ)</p>

      {totalOutstanding > 0 && (
        <p className="mb-4 rounded-[var(--radius-control)] bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          মোট বকেয়া: {formatTaka(totalOutstanding)} ({rows.length} জন সৈনিক)
        </p>
      )}

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-steel">কোনো বকেয়া নেই — সব হিসাব পরিষ্কার।</p>}

      {!loading && rows.length > 0 && (
        <div className="mb-3">
          <ExportBar
            filename="outstanding-balances-report"
            title="বকেয়া-তালিকা রিপোর্ট (Outstanding Balances)"
            subtitle={`${rows.length} জন সৈনিক, মোট ${formatTaka(totalOutstanding)}`}
            data={rows}
            columns={[
              { label: 'সার্ভিস#', value: (r) => r.service_id },
              { label: 'নাম', value: (r) => r.name },
              { label: 'মোট ক্রয়', value: (r) => r.total_purchases },
              { label: 'পরিশোধিত', value: (r) => r.total_paid },
              { label: 'বকেয়া', value: (r) => r.outstanding_balance },
            ]}
          />
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
          {rows.map((r, idx) => (
            <Link
              key={r.soldier_id}
              to={`/soldiers/${r.soldier_id}`}
              className={`flex items-center justify-between px-3 py-2.5 text-sm hover:bg-paper ${idx !== rows.length - 1 ? 'border-b border-steel/10' : ''}`}
            >
              <div>
                <p className="text-navy underline">{r.name}</p>
                <p className="text-xs text-steel">সার্ভিস#{r.service_id}</p>
              </div>
              <p className="font-data font-medium tabular-nums text-danger">{formatTaka(r.outstanding_balance)}</p>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

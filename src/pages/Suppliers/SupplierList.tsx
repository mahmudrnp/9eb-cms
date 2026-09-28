import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { fetchSuppliersWithPayable } from '../../lib/purchases';
import type { SupplierWithPayable } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function SupplierListPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuppliersWithPayable()
      .then(setSuppliers)
      .catch(() => setError('সরবরাহকারী-তালিকা লোড করা যায়নি।'))
      .finally(() => setLoading(false));
  }, []);

  const totalPayable = suppliers.reduce((sum, s) => sum + s.outstanding_payable, 0);

  return (
    <AppLayout>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">সরবরাহকারী</h1>
        <Link to="/purchases/new" className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-navy-hover)]">
          + নতুন ক্রয়
        </Link>
      </div>

      {totalPayable > 0 && (
        <p className="mb-3 rounded-[var(--radius-control)] bg-danger/10 px-3 py-2 text-sm text-danger">
          মোট সরবরাহকারী-বকেয়া: {formatTaka(totalPayable)}
        </p>
      )}

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}

      {!loading && suppliers.length === 0 && (
        <p className="text-sm text-steel">এখনো কোনো সরবরাহকারী নেই — "নতুন ক্রয়" থেকে যোগ করা যাবে।</p>
      )}

      {!loading && suppliers.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
          {suppliers.map((s, idx) => (
            <Link
              key={s.id}
              to={`/suppliers/${s.id}`}
              className={`flex items-center justify-between px-3 py-2.5 text-sm hover:bg-paper ${
                idx !== suppliers.length - 1 ? 'border-b border-steel/10' : ''
              }`}
            >
              <div>
                <p className="text-navy underline">{s.name}</p>
                {s.contact && <p className="text-xs text-steel">{s.contact}</p>}
              </div>
              <p className={`font-data tabular-nums ${s.outstanding_payable > 0 ? 'text-danger' : 'text-steel'}`}>
                {formatTaka(s.outstanding_payable)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

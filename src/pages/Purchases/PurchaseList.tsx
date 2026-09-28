import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { fetchPurchases } from '../../lib/purchases';
import type { PurchaseWithSupplier } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}
const statusLabel: Record<string, string> = { paid: 'পরিশোধিত', due: 'বাকি', partial: 'আংশিক' };

export function PurchaseListPage() {
  const { profile } = useAuth();
  const canCreate = profile?.role === 'canteen_admin';
  const [purchases, setPurchases] = useState<PurchaseWithSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPurchases()
      .then(setPurchases)
      .catch(() => setError('ক্রয়-তালিকা লোড করা যায়নি।'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">ক্রয়-তালিকা</h1>
        <div className="flex gap-2">
          <Link to="/suppliers" className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm font-medium text-ink hover:bg-steel/10">
            সরবরাহকারী
          </Link>
          {canCreate && (
            <Link to="/purchases/import" className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm font-medium text-ink hover:bg-steel/10">
              বাল্ক আমদানি
            </Link>
          )}
          {canCreate && (
            <Link to="/purchases/new" className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-navy-hover)]">
              + নতুন ক্রয়
            </Link>
          )}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}
      {!loading && purchases.length === 0 && <p className="text-sm text-steel">এখনো কোনো ক্রয় নেই।</p>}

      {!loading && purchases.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-steel/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-white">
                <th className="px-3 py-2 font-medium">তারিখ</th>
                <th className="px-3 py-2 font-medium">সরবরাহকারী</th>
                <th className="px-3 py-2 font-medium">ইনভয়েস</th>
                <th className="px-3 py-2 font-medium">স্ট্যাটাস</th>
                <th className="px-3 py-2 text-right font-medium">মোট</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t border-steel/15 hover:bg-paper">
                  <td className="px-3 py-2 font-data tabular-nums">{formatDate(p.purchase_date)}</td>
                  <td className="px-3 py-2">
                    <Link to={`/purchases/${p.id}`} className="text-navy underline">
                      {p.suppliers?.name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-steel">{p.invoice_ref ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${p.payment_status === 'paid' ? 'bg-success/10 text-success' : p.payment_status === 'partial' ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'}`}>
                      {statusLabel[p.payment_status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-data tabular-nums">{formatTaka(p.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { fetchPurchase, fetchPurchaseItems } from '../../lib/purchases';
import type { PurchaseWithSupplier, PurchaseItemWithProduct } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}
const statusLabel: Record<string, string> = { paid: 'পরিশোধিত', due: 'বাকি', partial: 'আংশিক' };

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [purchase, setPurchase] = useState<PurchaseWithSupplier | null>(null);
  const [items, setItems] = useState<PurchaseItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchPurchase(id), fetchPurchaseItems(id)])
      .then(([p, i]) => {
        setPurchase(p);
        setItems(i);
      })
      .catch(() => setError('তথ্য লোড করা যায়নি।'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-steel">লোড হচ্ছে…</p>
      </AppLayout>
    );
  }

  if (error || !purchase) {
    return (
      <AppLayout>
        <p className="text-sm text-danger">{error ?? 'ক্রয় পাওয়া যায়নি।'}</p>
        <Link to="/purchases" className="mt-2 inline-block text-sm text-navy underline">তালিকায় ফিরে যান</Link>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">
            <Link to={`/suppliers/${purchase.supplier_id}`} className="text-navy underline">
              {purchase.suppliers?.name ?? '—'}
            </Link>
          </h1>
          <p className="text-sm text-steel">
            {formatDate(purchase.purchase_date)}
            {purchase.invoice_ref ? ` · ইনভয়েস: ${purchase.invoice_ref}` : ''}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs ${purchase.payment_status === 'paid' ? 'bg-success/10 text-success' : purchase.payment_status === 'partial' ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'}`}>
          {statusLabel[purchase.payment_status]}
        </span>
      </div>

      <div className="mb-5 overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-left text-white">
              <th className="px-3 py-2 font-medium">পণ্য</th>
              <th className="px-3 py-2 text-right font-medium">পরিমাণ</th>
              <th className="px-3 py-2 text-right font-medium">একক-মূল্য</th>
              <th className="px-3 py-2 text-right font-medium">মোট</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-steel/15">
                <td className="px-3 py-2">{it.products?.name ?? '—'}</td>
                <td className="px-3 py-2 text-right font-data tabular-nums">
                  {it.quantity} {it.products?.unit}
                </td>
                <td className="px-3 py-2 text-right font-data tabular-nums">{formatTaka(it.unit_cost)}</td>
                <td className="px-3 py-2 text-right font-data tabular-nums">{formatTaka(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-steel/20 font-semibold">
              <td className="px-3 py-2" colSpan={3}>মোট</td>
              <td className="px-3 py-2 text-right font-data tabular-nums">{formatTaka(purchase.total_cost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {purchase.remarks && <p className="text-sm text-steel">মন্তব্য: {purchase.remarks}</p>}
    </AppLayout>
  );
}

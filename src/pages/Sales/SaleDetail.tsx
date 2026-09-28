import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { fetchSale, fetchSaleItems } from '../../lib/sales';
import type { SaleWithSoldier, SaleItemWithProduct } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const paymentLabel: Record<string, string> = { cash: 'নগদ', credit: 'বাকি', partial: 'আংশিক' };

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<SaleWithSoldier | null>(null);
  const [items, setItems] = useState<SaleItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchSale(id), fetchSaleItems(id)])
      .then(([s, i]) => {
        setSale(s);
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

  if (error || !sale) {
    return (
      <AppLayout>
        <p className="text-sm text-danger">{error ?? 'বিক্রয় পাওয়া যায়নি।'}</p>
      </AppLayout>
    );
  }

  const outstanding = sale.total_amount - sale.paid_amount;

  return (
    <AppLayout>
      <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-steel/20 bg-white p-5">
        <div className="mb-4 text-center">
          <p className="font-data text-sm text-steel">{sale.receipt_no}</p>
          <p className="text-xs text-steel">{formatDateTime(sale.sale_date)}</p>
        </div>

        <div className="mb-3 border-b border-steel/15 pb-3">
          <p className="text-sm font-medium text-ink">
            <Link to={`/soldiers/${sale.soldier_id}`} className="text-navy underline">
              {sale.soldiers?.name ?? '—'}
            </Link>
          </p>
          <p className="text-xs text-steel">সার্ভিস#{sale.soldiers?.service_id}</p>
        </div>

        <div className="mb-3 space-y-1">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm">
              <span className="text-ink">
                {it.products?.name} × {it.quantity} {it.products?.unit}
              </span>
              <span className="font-data tabular-nums text-ink">{formatTaka(it.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-steel/15 pt-2 text-sm">
          <div className="flex justify-between text-steel">
            <span>সাবটোটাল</span>
            <span className="font-data tabular-nums">{formatTaka(sale.subtotal)}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div className="flex justify-between text-steel">
              <span>ডিসকাউন্ট</span>
              <span className="font-data tabular-nums">−{formatTaka(sale.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-ink">
            <span>মোট</span>
            <span className="font-data tabular-nums">{formatTaka(sale.total_amount)}</span>
          </div>
          <div className="flex justify-between text-steel">
            <span>পেমেন্ট-ধরন</span>
            <span>{paymentLabel[sale.payment_type]}</span>
          </div>
          <div className="flex justify-between text-success">
            <span>পরিশোধিত</span>
            <span className="font-data tabular-nums">{formatTaka(sale.paid_amount)}</span>
          </div>
          {outstanding > 0 && (
            <div className="flex justify-between font-medium text-danger">
              <span>বকেয়া</span>
              <span className="font-data tabular-nums">{formatTaka(outstanding)}</span>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchSupplierWithPayable,
  fetchSupplierPurchases,
  fetchSupplierPayments,
  recordSupplierPayment,
} from '../../lib/purchases';
import type { SupplierWithPayable, PurchaseWithSupplier, SupplierPayment } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const canPay = profile?.role === 'canteen_admin';

  const [supplier, setSupplier] = useState<SupplierWithPayable | null>(null);
  const [purchases, setPurchases] = useState<PurchaseWithSupplier[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [s, p, pay] = await Promise.all([
        fetchSupplierWithPayable(id),
        fetchSupplierPurchases(id),
        fetchSupplierPayments(id),
      ]);
      setSupplier(s);
      setPurchases(p);
      setPayments(pay);
    } catch {
      setError('তথ্য লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handlePaySubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setPayError(null);
    setPaySaving(true);
    try {
      await recordSupplierPayment(id, Number(payAmount), profile!.id);
      setShowPayForm(false);
      setPayAmount('');
      await load();
    } catch {
      setPayError('সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।');
    } finally {
      setPaySaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-steel">লোড হচ্ছে…</p>
      </AppLayout>
    );
  }

  if (error || !supplier) {
    return (
      <AppLayout>
        <p className="text-sm text-danger">{error ?? 'সরবরাহকারী পাওয়া যায়নি।'}</p>
        <Link to="/suppliers" className="mt-2 inline-block text-sm text-navy underline">তালিকায় ফিরে যান</Link>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-ink">{supplier.name}</h1>
        {supplier.contact && <p className="text-sm text-steel">{supplier.contact}</p>}
      </div>

      <div className="mb-5 flex items-center justify-between rounded-[var(--radius-card)] border border-steel/20 bg-white p-4">
        <div>
          <p className="text-xs text-steel">অবশিষ্ট বকেয়া (payable)</p>
          <p className={`font-data text-xl font-semibold tabular-nums ${supplier.outstanding_payable > 0 ? 'text-danger' : 'text-ink'}`}>
            {formatTaka(supplier.outstanding_payable)}
          </p>
        </div>
        {canPay && (
          <button
            onClick={() => setShowPayForm((v) => !v)}
            className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-navy-hover)]"
          >
            পেমেন্ট দিন
          </button>
        )}
      </div>

      {showPayForm && (
        <form onSubmit={handlePaySubmit} className="mb-5 max-w-sm rounded-[var(--radius-card)] border border-steel/20 bg-white p-4">
          <label className="mb-1 block text-sm font-medium text-ink">পরিমাণ (৳) *</label>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="mb-3 w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
          />
          {payError && <p className="mb-3 text-sm text-danger">{payError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={paySaving} className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {paySaving ? 'সংরক্ষণ হচ্ছে…' : 'নিশ্চিত করুন'}
            </button>
            <button type="button" onClick={() => setShowPayForm(false)} className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm text-ink">
              বাতিল
            </button>
          </div>
        </form>
      )}

      <h2 className="mb-2 text-sm font-semibold text-ink">ক্রয়-ইতিহাস</h2>
      {purchases.length === 0 ? (
        <p className="mb-5 text-sm text-steel">এখনো কোনো ক্রয় নেই।</p>
      ) : (
        <div className="mb-5 overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
          {purchases.map((p, idx) => (
            <Link
              key={p.id}
              to={`/purchases/${p.id}`}
              className={`flex items-center justify-between px-3 py-2.5 text-sm hover:bg-paper ${idx !== purchases.length - 1 ? 'border-b border-steel/10' : ''}`}
            >
              <div>
                <p className="text-navy underline">{p.invoice_ref || 'ইনভয়েস নম্বর নেই'}</p>
                <p className="text-xs text-steel">{formatDate(p.purchase_date)}</p>
              </div>
              <p className="font-data tabular-nums text-ink">{formatTaka(p.total_cost)}</p>
            </Link>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-ink">পেমেন্ট-ইতিহাস</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-steel">এখনো কোনো পেমেন্ট নেই।</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
          {payments.map((p, idx) => (
            <div key={p.id} className={`flex items-center justify-between px-3 py-2.5 text-sm ${idx !== payments.length - 1 ? 'border-b border-steel/10' : ''}`}>
              <p className="text-xs text-steel">{formatDate(p.payment_date)}</p>
              <p className="font-data tabular-nums text-success">+{formatTaka(p.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

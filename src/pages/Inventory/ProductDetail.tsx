import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { fetchProduct, fetchStockHistory, recordStockAdjustment } from '../../lib/inventory';
import type { ProductWithStock, StockTransaction, StockTxnType } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

const txnTypeLabel: Record<StockTxnType, string> = {
  purchase_in: 'ক্রয়-ইন',
  sale_out: 'বিক্রয়-আউট',
  adjustment: 'সমন্বয়',
  damage: 'ক্ষতিগ্রস্ত',
  expired: 'মেয়াদোত্তীর্ণ',
};

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const canAdjust = profile?.role === 'canteen_admin';

  const [product, setProduct] = useState<ProductWithStock | null>(null);
  const [history, setHistory] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustType, setAdjustType] = useState<StockTxnType>('adjustment');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [overrideApplied, setOverrideApplied] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [p, h] = await Promise.all([fetchProduct(id), fetchStockHistory(id)]);
      setProduct(p);
      setHistory(h);
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

  async function handleAdjustSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setAdjustError(null);
    setAdjustSaving(true);
    try {
      await recordStockAdjustment({
        productId: id,
        txnType: adjustType,
        quantity: Number(adjustQty),
        reason: adjustReason.trim(),
        overrideApplied,
        recordedBy: profile!.id,
      });
      setShowAdjustForm(false);
      setAdjustQty('');
      setAdjustReason('');
      setOverrideApplied(false);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('ঋণাত্মক স্টক') || message.includes('negative')) {
        setAdjustError('এই পরিমাণ বিয়োগ করলে স্টক ঋণাত্মক হয়ে যাবে — override-চেকবক্স টিক দিয়ে আবার চেষ্টা করুন।');
      } else {
        setAdjustError('সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।');
      }
    } finally {
      setAdjustSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-steel">লোড হচ্ছে…</p>
      </AppLayout>
    );
  }

  if (error || !product) {
    return (
      <AppLayout>
        <p className="text-sm text-danger">{error ?? 'পণ্য পাওয়া যায়নি।'}</p>
        <Link to="/inventory" className="mt-2 inline-block text-sm text-navy underline">
          তালিকায় ফিরে যান
        </Link>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">{product.name}</h1>
          <p className="text-sm text-steel">
            {product.categories?.name ?? 'কোনো ক্যাটাগরি নেই'}
            {product.sku ? ` · SKU: ${product.sku}` : ''}
          </p>
          {product.suppliers?.name && <p className="text-sm text-steel">সরবরাহকারী: {product.suppliers.name}</p>}
        </div>
        {profile?.role === 'canteen_admin' && (
          <Link
            to={`/inventory/${product.id}/edit`}
            className="rounded-[var(--radius-control)] border border-steel/40 px-3 py-1.5 text-sm text-ink hover:bg-steel/10"
          >
            সম্পাদনা
          </Link>
        )}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-3">
          <p className="text-xs text-steel">বর্তমান স্টক</p>
          <p
            className={`font-data text-lg font-semibold tabular-nums ${
              product.is_low_stock ? 'text-warning' : 'text-ink'
            }`}
          >
            {product.current_qty} {product.unit}
          </p>
          {product.is_low_stock && <p className="text-xs text-warning">⚠ ন্যূনতম-স্তরের নিচে</p>}
        </div>
        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-3">
          <p className="text-xs text-steel">ক্রয়-মূল্য</p>
          <p className="font-data text-lg font-semibold tabular-nums text-ink">{formatTaka(product.purchase_price)}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-3">
          <p className="text-xs text-steel">বিক্রয়-মূল্য</p>
          <p className="font-data text-lg font-semibold tabular-nums text-ink">{formatTaka(product.selling_price)}</p>
        </div>
      </div>

      {canAdjust && (
        <div className="mb-5">
          {!showAdjustForm ? (
            <button
              onClick={() => setShowAdjustForm(true)}
              className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm font-medium text-ink hover:bg-steel/10"
            >
              স্টক সমন্বয় করুন
            </button>
          ) : (
            <form
              onSubmit={handleAdjustSubmit}
              className="max-w-md rounded-[var(--radius-card)] border border-steel/20 bg-white p-4"
            >
              <h3 className="mb-3 text-sm font-semibold text-ink">স্টক সমন্বয়-এন্ট্রি</h3>

              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-ink">ধরন</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as StockTxnType)}
                  className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
                >
                  <option value="adjustment">সমন্বয় (বৃদ্ধি)</option>
                  <option value="damage">ক্ষতিগ্রস্ত (হ্রাস)</option>
                  <option value="expired">মেয়াদোত্তীর্ণ (হ্রাস)</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-ink">পরিমাণ *</label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
                />
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-ink">কারণ *</label>
                <input
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
                />
              </div>

              <label className="mb-3 flex items-center gap-1.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={overrideApplied}
                  onChange={(e) => setOverrideApplied(e.target.checked)}
                />
                ঋণাত্মক-স্টক override (শুধু নিশ্চিত হলে — অডিট-লগে রেকর্ড হবে)
              </label>

              {adjustError && (
                <p role="alert" className="mb-3 rounded-[var(--radius-control)] bg-danger/10 px-3 py-2 text-sm text-danger">
                  {adjustError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adjustSaving}
                  className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {adjustSaving ? 'সংরক্ষণ হচ্ছে…' : 'নিশ্চিত করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdjustForm(false)}
                  className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm text-ink"
                >
                  বাতিল
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-ink">স্টক-হিস্ট্রি</h2>
      {history.length === 0 ? (
        <p className="text-sm text-steel">এখনো কোনো স্টক-লেনদেন হয়নি।</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
          {history.map((h, idx) => (
            <div
              key={h.id}
              className={`flex items-center justify-between px-3 py-2.5 text-sm ${
                idx !== history.length - 1 ? 'border-b border-steel/10' : ''
              }`}
            >
              <div>
                <p className="text-ink">
                  {txnTypeLabel[h.txn_type]}
                  {h.reason ? ` — ${h.reason}` : ''}
                  {h.override_applied && <span className="ml-1.5 text-xs text-warning">(override)</span>}
                </p>
                <p className="text-xs text-steel">{formatDate(h.txn_date)}</p>
              </div>
              <p className={`font-data tabular-nums ${h.quantity >= 0 ? 'text-success' : 'text-danger'}`}>
                {h.quantity >= 0 ? '+' : ''}
                {h.quantity} {product.unit}
              </p>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

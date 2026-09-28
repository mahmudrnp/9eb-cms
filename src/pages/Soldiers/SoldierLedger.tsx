import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSoldier, fetchSoldierLedger, fetchLedgerTimeline, recordSoldierPayment } from '../../lib/soldiers';
import type { SoldierWithUnit, SoldierLedgerRow, LedgerTimelineEntry } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SoldierLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const canEdit = profile?.role === 'canteen_admin';
  // Phase01 §৪ রিভিশন৩ সিদ্ধান্ত: Sales Operator-ও পেমেন্ট/ক্রেডিট-কালেকশন এন্ট্রি করতে পারবে
  const canCollectPayment = profile?.role === 'canteen_admin' || profile?.role === 'sales_operator';

  const [soldier, setSoldier] = useState<SoldierWithUnit | null>(null);
  const [ledger, setLedger] = useState<SoldierLedgerRow | null>(null);
  const [timeline, setTimeline] = useState<LedgerTimelineEntry[]>([]);
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
      const [s, l, t] = await Promise.all([fetchSoldier(id), fetchSoldierLedger(id), fetchLedgerTimeline(id)]);
      setSoldier(s);
      setLedger(l);
      setTimeline(t);
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
    if (!id || !profile) return;
    setPayError(null);
    const amount = Number(payAmount);
    if (amount <= 0) {
      setPayError('পরিমাণ ০-এর বেশি হতে হবে।');
      return;
    }
    setPaySaving(true);
    try {
      await recordSoldierPayment(id, amount, profile.id);
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

  if (error || !soldier) {
    return (
      <AppLayout>
        <p className="text-sm text-danger">{error ?? 'সৈনিক পাওয়া যায়নি।'}</p>
        <Link to="/soldiers" className="mt-2 inline-block text-sm text-navy underline">
          তালিকায় ফিরে যান
        </Link>
      </AppLayout>
    );
  }

  const outstanding = ledger?.outstanding_balance ?? 0;

  return (
    <AppLayout>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">{soldier.name}</h1>
          <p className="text-sm text-steel">
            {soldier.rank} · সার্ভিস#<span className="font-data">{soldier.service_id}</span>
          </p>
          <p className="text-sm text-steel">
            {soldier.companies?.name ?? '—'}
            {soldier.platoons?.name ? `, ${soldier.platoons.name}` : ''}
          </p>
          {soldier.mobile_number && <p className="font-data text-sm text-steel">{soldier.mobile_number}</p>}
          {soldier.remarks && <p className="mt-1 text-xs text-steel italic">{soldier.remarks}</p>}
        </div>
        {canEdit && (
          <Link
            to={`/soldiers/${soldier.id}/edit`}
            className="rounded-[var(--radius-control)] border border-steel/40 px-3 py-1.5 text-sm text-ink hover:bg-steel/10"
          >
            সম্পাদনা
          </Link>
        )}
      </div>

      {/* Phase03 ওয়্যারফ্রেম: মোট ক্রয় / পরিশোধিত / বকেয়া — ৩-কলাম স্ট্যাট-কার্ড */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-3">
          <p className="text-xs text-steel">মোট ক্রয়</p>
          <p className="font-data text-lg font-semibold tabular-nums text-ink">
            {formatTaka(ledger?.total_purchases ?? 0)}
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-3">
          <p className="text-xs text-steel">পরিশোধিত</p>
          <p className="font-data text-lg font-semibold tabular-nums text-success">
            {formatTaka(ledger?.total_paid ?? 0)}
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-3">
          <p className="text-xs text-steel">বকেয়া</p>
          <p className={`font-data text-lg font-semibold tabular-nums ${outstanding > 0 ? 'text-danger' : 'text-ink'}`}>
            {formatTaka(outstanding)}
          </p>
        </div>
      </div>

      {canCollectPayment && outstanding > 0 && (
        <div className="mb-5">
          {!showPayForm ? (
            <button
              onClick={() => setShowPayForm(true)}
              className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-navy-hover)]"
            >
              পেমেন্ট নিন
            </button>
          ) : (
            <form onSubmit={handlePaySubmit} className="max-w-sm rounded-[var(--radius-card)] border border-steel/20 bg-white p-4">
              <label className="mb-1 block text-sm font-medium text-ink">পরিমাণ (৳) *</label>
              <input
                required
                type="number"
                min="0.01"
                max={outstanding}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder={`সর্বোচ্চ ${formatTaka(outstanding)}`}
                className="mb-3 w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
              />
              {payError && <p className="mb-3 text-sm text-danger">{payError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={paySaving}
                  className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {paySaving ? 'সংরক্ষণ হচ্ছে…' : 'নিশ্চিত করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPayForm(false)}
                  className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm text-ink"
                >
                  বাতিল
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-ink">লেনদেন-ইতিহাস</h2>
      {timeline.length === 0 ? (
        <p className="text-sm text-steel">এখনো কোনো লেনদেন হয়নি।</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
          {timeline.map((entry, idx) => (
            <div
              key={`${entry.kind}-${entry.id}`}
              className={`flex items-center justify-between px-3 py-2.5 text-sm ${idx !== timeline.length - 1 ? 'border-b border-steel/10' : ''}`}
            >
              <div>
                <p className="text-ink">{entry.label}</p>
                <p className="text-xs text-steel">{formatDate(entry.date)}</p>
              </div>
              <p className={`font-data tabular-nums ${entry.kind === 'payment' ? 'text-success' : 'text-ink'}`}>
                {entry.kind === 'payment' ? '+' : ''}
                {formatTaka(entry.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

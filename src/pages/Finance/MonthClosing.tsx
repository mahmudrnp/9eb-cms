import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { fetchClosingPreview, finalizeMonthClosing, fetchClosingHistory } from '../../lib/monthClosing';
import type { MonthlyClosingPreview, MonthlyClosing } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Phase01 নীতি: প্রতি মাসের ২৬ তারিখ থেকে পরের মাসের ২৫ তারিখ পর্যন্ত একটা চক্র
function defaultCycle(): { start: string; end: string; closingMonth: string } {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), 25);
  if (today.getDate() < 26) end.setMonth(end.getMonth() - 1); // এখনো এই চক্র শেষ হয়নি হলে আগের মাসের ২৫ তারিখ
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  start.setDate(26);
  const closingMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end), closingMonth: iso(closingMonth) };
}

export function MonthClosingPage() {
  const { profile } = useAuth();
  const canFinalize = profile?.role === 'canteen_admin';

  const cycle = defaultCycle();
  const [startDate, setStartDate] = useState(cycle.start);
  const [endDate, setEndDate] = useState(cycle.end);
  const [closingMonth, setClosingMonth] = useState(cycle.closingMonth);

  const [preview, setPreview] = useState<MonthlyClosingPreview | null>(null);
  const [physicalStock, setPhysicalStock] = useState('');
  const [history, setHistory] = useState<MonthlyClosing[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [done, setDone] = useState(false);

  async function loadPreview() {
    setLoading(true);
    setError(null);
    try {
      setPreview(await fetchClosingPreview(startDate, endDate));
    } catch {
      setError('প্রিভিউ লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
    fetchClosingHistory().then(setHistory).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const variance = preview && physicalStock !== '' ? Number(physicalStock) - preview.expected_closing_stock : null;

  async function handleFinalize() {
    if (!preview || physicalStock === '') return;
    setFinalizeError(null);
    setFinalizing(true);
    try {
      await finalizeMonthClosing({
        closingMonth,
        startDate,
        endDate,
        physicalStock: Number(physicalStock),
      });
      setDone(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('ইতিমধ্যে ফাইনালাইজড')) {
        setFinalizeError('এই মাস ইতিমধ্যে ফাইনালাইজড — পুনরায় করা যাবে না।');
      } else if (message.includes('finalize_month_closing') || message.includes('function')) {
        setFinalizeError('ফাইনালাইজ করা যায়নি — supabase/phase11_functions.sql রান করা হয়েছে কিনা যাচাই করুন।');
      } else {
        setFinalizeError('ফাইনালাইজ করা যায়নি — আবার চেষ্টা করুন।');
      }
    } finally {
      setFinalizing(false);
    }
  }

  if (done) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-sm rounded-[var(--radius-card)] border border-success/30 bg-success/5 p-6 text-center">
          <p className="mb-1 text-2xl">✓</p>
          <p className="mb-1 font-semibold text-ink">মাস ফাইনালাইজ সম্পন্ন হয়েছে</p>
          <p className="text-sm text-steel">এই সময়সীমার লেনদেন এখন থেকে write-protected — সংশোধন লাগলে শুধু correction-entry।</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">মাস-সমাপনী (Month-End Closing)</h1>
      <p className="mb-5 text-sm text-steel">Phase01 নীতি: প্রতি মাসের ২৫ তারিখ, ২৬-২৫ চক্র ডিফল্ট (প্রয়োজনে পরিবর্তনযোগ্য)</p>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-steel">শুরু</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-steel">শেষ (২৫ তারিখ)</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-steel">ক্লোজিং-মাস (রেকর্ডের জন্য)</label>
          <input type="date" value={closingMonth} onChange={(e) => setClosingMonth(e.target.value)} className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy" />
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}

      {!loading && preview && (
        <>
          <div className="mb-5 max-w-md overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
            <p className="border-b border-steel/15 bg-paper px-4 py-2 text-xs font-semibold uppercase tracking-wide text-steel">স্টক-রিকনসিলিয়েশন (৳)</p>
            <Row label="ওপেনিং স্টক-মূল্য" value={preview.opening_stock_value} />
            <Row label="ক্রয় (+)" value={preview.purchased_value} positive />
            <Row label="বিক্রিত (ক্রয়-মূল্যে) (−)" value={-preview.sold_value} negative />
            <Row label="সমন্বয়/ক্ষতিগ্রস্ত/মেয়াদোত্তীর্ণ (±)" value={preview.adjustments_value} />
            <Row label="প্রত্যাশিত ক্লোজিং-স্টক" value={preview.expected_closing_stock} bold border />

            <p className="border-y border-steel/15 bg-paper px-4 py-2 text-xs font-semibold uppercase tracking-wide text-steel">আর্থিক-সারাংশ (৳)</p>
            <Row label="বিক্রয়-রাজস্ব" value={preview.sales_revenue} />
            <Row label="COGS" value={-preview.cogs} negative />
            <Row label="গ্রস প্রফিট" value={preview.gross_profit} bold />
            <Row label="খরচ" value={-preview.expenses_total} negative />
            <Row label="নিট ফলাফল" value={preview.net_result} bold border valueClass={preview.net_result >= 0 ? 'text-success' : 'text-danger'} />
          </div>

          <div className="mb-5 max-w-sm">
            <label className="mb-1 block text-sm font-medium text-ink">ফিজিক্যাল স্টক-গণনার মূল্য (৳) *</label>
            <input
              type="number"
              step="0.01"
              value={physicalStock}
              onChange={(e) => setPhysicalStock(e.target.value)}
              placeholder="ম্যানুয়াল গণনার পর মোট মূল্য বসান"
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
            />
            {variance !== null && (
              <p className={`mt-2 text-sm ${Math.abs(variance) < 0.01 ? 'text-success' : 'text-warning'}`}>
                ভ্যারিয়েন্স: {formatTaka(variance)} {Math.abs(variance) >= 0.01 && '⚠ অমিল আছে'}
              </p>
            )}
          </div>

          {canFinalize && (
            <div className="mb-8">
              {!confirmStep ? (
                <button
                  onClick={() => setConfirmStep(true)}
                  disabled={physicalStock === ''}
                  className="rounded-[var(--radius-control)] bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-navy-hover)] disabled:opacity-50"
                >
                  মাস ফাইনালাইজ করুন
                </button>
              ) : (
                <div className="max-w-md rounded-[var(--radius-card)] border border-danger/30 bg-danger/5 p-4">
                  <p className="mb-3 text-sm font-medium text-danger">
                    ⚠ নিশ্চিত? ফাইনালাইজ করার পর এই সময়সীমার কোনো লেনদেন আর এডিট/ডিলিট করা যাবে না — শুধু সংশোধনী-এন্ট্রি দিয়ে ঠিক করতে হবে।
                  </p>
                  {finalizeError && <p className="mb-3 text-sm text-danger">{finalizeError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleFinalize} disabled={finalizing} className="rounded-[var(--radius-control)] bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                      {finalizing ? 'ফাইনালাইজ হচ্ছে…' : 'হ্যাঁ, ফাইনালাইজ করুন'}
                    </button>
                    <button onClick={() => setConfirmStep(false)} className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm text-ink">
                      বাতিল
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {history.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-ink">পূর্ববর্তী ক্লোজিং-ইতিহাস</h2>
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
            {history.map((h, idx) => (
              <div key={h.id} className={`flex items-center justify-between px-3 py-2.5 text-sm ${idx !== history.length - 1 ? 'border-b border-steel/10' : ''}`}>
                <div>
                  <p className="text-ink">{formatDate(h.closing_month)}</p>
                  <p className="text-xs text-steel">নিট: {formatTaka(h.net_result)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${h.status === 'finalized' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                  {h.status === 'finalized' ? 'ফাইনালাইজড' : 'ড্রাফট'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}

function Row({
  label, value, bold, border, negative, positive, valueClass,
}: { label: string; value: number; bold?: boolean; border?: boolean; negative?: boolean; positive?: boolean; valueClass?: string }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2 text-sm ${border ? 'border-t border-steel/20' : 'border-b border-steel/10'}`}>
      <p className={bold ? 'font-semibold text-ink' : 'text-ink'}>{label}</p>
      <p className={`font-data tabular-nums ${bold ? 'font-semibold' : ''} ${valueClass ?? (negative ? 'text-danger' : positive ? 'text-success' : 'text-ink')}`}>
        {formatTaka(value)}
      </p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { fetchProfitLoss } from '../../lib/finance';
import { ExportBar } from '../../components/ExportBar';
import type { ProfitLossResult } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

type Preset = 'today' | 'month' | 'custom';

export function ProfitLossPage() {
  const [preset, setPreset] = useState<Preset>('month');
  const [startDate, setStartDate] = useState(firstOfMonthISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [result, setResult] = useState<ProfitLossResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === 'today') {
      setStartDate(todayISO());
      setEndDate(todayISO());
    } else if (p === 'month') {
      setStartDate(firstOfMonthISO());
      setEndDate(todayISO());
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchProfitLoss(startDate, endDate));
    } catch {
      setError('রিপোর্ট লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">লাভ-ক্ষতি রিপোর্ট</h1>
      <p className="mb-5 text-sm text-steel">Phase02 `profit_loss()` ফাংশন থেকে লাইভ-গণনা — কোনো স্টোরড-সামারি-ফিল্ড না</p>

      <div className="mb-5 flex flex-wrap items-end gap-2">
        <div className="flex gap-2">
          {(['today', 'month', 'custom'] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium ${
                preset === p ? 'border-navy bg-navy text-white' : 'border-steel/30 text-ink'
              }`}
            >
              {p === 'today' ? 'আজ' : p === 'month' ? 'এই মাস' : 'কাস্টম'}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy"
            />
            <span className="text-steel">থেকে</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy"
            />
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}

      {!loading && result && (
        <div className="mb-3">
          <ExportBar
            filename="profit-loss-report"
            title="লাভ-ক্ষতি রিপোর্ট (Profit & Loss)"
            subtitle={`${startDate} থেকে ${endDate}`}
            data={[
              { label: 'বিক্রয়-রাজস্ব (Sales Revenue)', value: result.sales_revenue },
              { label: 'COGS', value: result.cogs },
              { label: 'গ্রস প্রফিট', value: result.gross_profit },
              { label: 'খরচ (Expenses)', value: result.expenses_total },
              { label: 'নিট ফলাফল (Net Result)', value: result.net_result },
            ]}
            columns={[
              { label: 'খাত', value: (r) => r.label },
              { label: 'পরিমাণ (৳)', value: (r) => r.value },
            ]}
          />
        </div>
      )}

      {!loading && result && (
        <div className="max-w-md overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
          <Row label="বিক্রয়-রাজস্ব (Sales Revenue)" value={result.sales_revenue} hint="নগদ+বাকি+আংশিক সব বিক্রয়" />
          <Row label="COGS (বিক্রিত পণ্যের ক্রয়-মূল্য)" value={-result.cogs} negative />
          <Row label="গ্রস প্রফিট" value={result.gross_profit} bold border />
          <Row label="খরচ (Expenses)" value={-result.expenses_total} negative />
          <Row
            label="নিট ফলাফল (Net Result)"
            value={result.net_result}
            bold
            border
            valueClass={result.net_result >= 0 ? 'text-success' : 'text-danger'}
          />
        </div>
      )}

      <p className="mt-4 max-w-md text-xs text-steel">
        ⚠ Sales Revenue ≠ Cash Received (বাকি-বিক্রয়ও Revenue-এর অংশ) · Purchase Cost ≠ COGS (শুধু বিক্রিত অংশের ক্রয়-মূল্য) — Phase01 §৬.৫ নীতি
      </p>
    </AppLayout>
  );
}

function Row({
  label,
  value,
  bold,
  border,
  negative,
  hint,
  valueClass,
}: {
  label: string;
  value: number;
  bold?: boolean;
  border?: boolean;
  negative?: boolean;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 text-sm ${border ? 'border-t border-steel/20' : 'border-b border-steel/10'}`}>
      <div>
        <p className={bold ? 'font-semibold text-ink' : 'text-ink'}>{label}</p>
        {hint && <p className="text-xs text-steel">{hint}</p>}
      </div>
      <p className={`font-data tabular-nums ${bold ? 'font-semibold' : ''} ${valueClass ?? (negative ? 'text-danger' : 'text-ink')}`}>
        {formatTaka(value)}
      </p>
    </div>
  );
}

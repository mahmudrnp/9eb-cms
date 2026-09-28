import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { fetchDashboardSummary } from '../lib/dashboard';
import type { DashboardSummary, PaymentType } from '../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
}
const paymentLabel: Record<PaymentType, string> = { cash: 'নগদ', credit: 'বাকি', partial: 'আংশিক' };
const paymentColor: Record<PaymentType, string> = {
  cash: 'bg-success/10 text-success',
  credit: 'bg-danger/10 text-danger',
  partial: 'bg-warning/10 text-warning',
};

export function DashboardPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'canteen_admin';
  const canSeeFinancials = profile?.role === 'canteen_admin' || profile?.role === 'viewer';

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardSummary()
      .then(setData)
      .catch(() => setError('ড্যাশবোর্ড লোড করা যায়নি।'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-steel">লোড হচ্ছে…</p>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <p className="text-sm text-danger">{error ?? 'ডেটা পাওয়া যায়নি।'}</p>
      </AppLayout>
    );
  }

  const paymentSplit = [
    { name: 'নগদ', value: data.monthCashSales, color: 'var(--color-success)' },
    { name: 'আংশিক', value: data.monthPartialSales, color: 'var(--color-warning)' },
    { name: 'বাকি', value: data.monthCreditSales, color: 'var(--color-crest-red)' },
  ].filter((s) => s.value > 0);

  const today = new Date().toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <AppLayout>
      {/* হেডার-ব্যান্ড — এন্টারপ্রাইজ-স্টাইল */}
      <div className="mb-5 rounded-[var(--radius-card)] bg-navy px-4 py-3 text-white">
        <p className="text-xs uppercase tracking-wide text-white/70">৯ ইস্ট বেঙ্গল রেজিমেন্ট · ক্যান্টিন ড্যাশবোর্ড</p>
        <p className="font-data text-sm text-white/90">{today}</p>
      </div>

      {/* গুরুত্বপূর্ণ অ্যালার্ট — সবার আগে, দ্রুত-স্ক্যানযোগ্য */}
      {(data.lowStockProducts.length > 0 || data.totalOutstanding > 0 || data.expiringBatchesCount > 0) && (
        <div className="mb-5 grid gap-2 sm:grid-cols-3">
          {data.lowStockProducts.length > 0 && (
            <Link to="/inventory" className="rounded-[var(--radius-control)] border-l-4 border-warning bg-warning/10 px-3 py-2 text-sm text-warning">
              ⚠ {data.lowStockProducts.length}টা পণ্য লো-স্টকে
            </Link>
          )}
          {data.totalOutstanding > 0 && (
            <Link to="/credit" className="rounded-[var(--radius-control)] border-l-4 border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
              মোট বকেয়া {formatTaka(data.totalOutstanding)}
            </Link>
          )}
          {data.expiringBatchesCount > 0 && (
            <Link to="/inventory/expiry" className="rounded-[var(--radius-control)] border-l-4 border-crest-red bg-crest-red/10 px-3 py-2 text-sm text-crest-red">
              ⏰ {data.expiringBatchesCount}টা ব্যাচের মেয়াদ শীঘ্রই শেষ
            </Link>
          )}
        </div>
      )}

      {/* স্ট্যাট-কার্ড — এন্টারপ্রাইজ প্যাটার্ন: অ্যাকসেন্ট-বর্ডার + বড়-সংখ্যা */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="আজকের বিক্রয়" value={formatTaka(data.todaySales)} accent="border-navy" />
        <StatCard label="মাসিক বিক্রয়" value={formatTaka(data.monthSales)} accent="border-navy" />
        <StatCard label="মোট স্টক-মূল্য" value={formatTaka(data.totalStockValue)} accent="border-steel" />
        <StatCard label="সক্রিয় পণ্য" value={String(data.totalActiveProducts)} accent="border-steel" />
        {canSeeFinancials && (
          <>
            <StatCard label="এই মাসের ক্রয়-মূল্য" value={formatTaka(data.monthPurchaseValue)} accent="border-steel" />
            <StatCard
              label="এই মাসের গ্রস প্রফিট"
              value={formatTaka(data.monthGrossProfit)}
              valueClass={data.monthGrossProfit >= 0 ? 'text-success' : 'text-danger'}
              accent={data.monthGrossProfit >= 0 ? 'border-success' : 'border-danger'}
            />
          </>
        )}
        <StatCard label="মোট বকেয়া" value={formatTaka(data.totalOutstanding)} valueClass={data.totalOutstanding > 0 ? 'text-danger' : undefined} accent="border-danger" />
        <StatCard label="লো-স্টক পণ্য" value={String(data.lowStockProducts.length)} valueClass={data.lowStockProducts.length > 0 ? 'text-warning' : undefined} accent="border-warning" />
      </div>

      {/* চার্ট-রো: ৭-দিনের বিক্রয়-প্রবণতা + পেমেন্ট-বিভাজন */}
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-3 md:col-span-2">
          <p className="mb-2 text-xs font-medium text-steel">গত ৭ দিনের বিক্রয়-প্রবণতা</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesTrend} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-navy)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-navy)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(v) => formatShortDate(String(v))} formatter={(v) => [formatTaka(Number(v)), 'বিক্রয়']} />
                <Area type="monotone" dataKey="amount" stroke="var(--color-navy)" fill="url(#trendFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-3">
          <p className="mb-2 text-xs font-medium text-steel">এই মাসের বিক্রয় — পেমেন্ট-ধরন</p>
          {paymentSplit.length === 0 ? (
            <p className="mt-8 text-center text-sm text-steel">এখনো কোনো বিক্রয় নেই</p>
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentSplit} dataKey="value" nameKey="name" innerRadius={35} outerRadius={55} paddingAngle={2}>
                    {paymentSplit.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatTaka(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-1 flex flex-wrap justify-center gap-3 text-xs text-steel">
            <span>● নগদ {formatTaka(data.monthCashSales)}</span>
            <span>● আংশিক {formatTaka(data.monthPartialSales)}</span>
            <span>● বাকি {formatTaka(data.monthCreditSales)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* সাম্প্রতিক লেনদেন */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">সাম্প্রতিক লেনদেন</h2>
          {data.recentSales.length === 0 ? (
            <p className="text-sm text-steel">এখনো কোনো বিক্রয় হয়নি।</p>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
              {data.recentSales.map((s, idx) => (
                <Link
                  key={s.id}
                  to={`/sales/${s.id}`}
                  className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-paper ${idx !== data.recentSales.length - 1 ? 'border-b border-steel/10' : ''}`}
                >
                  <div>
                    <p className="text-ink">{s.soldier_name}</p>
                    <p className="text-xs text-steel">{s.receipt_no} · {formatDateTime(s.sale_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-data tabular-nums text-ink">{formatTaka(s.total_amount)}</p>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${paymentColor[s.payment_type]}`}>{paymentLabel[s.payment_type]}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* বকেয়া-শীর্ষ + লো-স্টক */}
        <div className="space-y-5">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink">সর্বোচ্চ বকেয়া</h2>
            {data.topOutstandingSoldiers.length === 0 ? (
              <p className="text-sm text-steel">কোনো বকেয়া নেই।</p>
            ) : (
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
                {data.topOutstandingSoldiers.map((s, idx) => (
                  <Link
                    key={s.soldier_id}
                    to={`/soldiers/${s.soldier_id}`}
                    className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-paper ${idx !== data.topOutstandingSoldiers.length - 1 ? 'border-b border-steel/10' : ''}`}
                  >
                    <span className="text-navy underline">{s.name}</span>
                    <span className="font-data tabular-nums text-danger">{formatTaka(s.outstanding_balance)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink">লো-স্টক পণ্য</h2>
            {data.lowStockProducts.length === 0 ? (
              <p className="text-sm text-steel">কোনো পণ্য লো-স্টকে নেই।</p>
            ) : (
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
                {data.lowStockProducts.map((p, idx) => (
                  <Link
                    key={p.id}
                    to={`/inventory/${p.id}`}
                    className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-paper ${idx !== data.lowStockProducts.length - 1 ? 'border-b border-steel/10' : ''}`}
                  >
                    <span className="text-navy underline">{p.name}</span>
                    <span className="font-data tabular-nums text-warning">{p.current_qty} {p.unit}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-steel/15 pt-4">
          <Link to="/reports" className="rounded-[var(--radius-control)] border border-steel/30 bg-white px-3 py-2 text-sm text-ink hover:border-navy">
            রিপোর্ট
          </Link>
          <Link to="/month-closing" className="rounded-[var(--radius-control)] border border-steel/30 bg-white px-3 py-2 text-sm text-ink hover:border-navy">
            মাস-সমাপনী
          </Link>
          <Link to="/expenses" className="rounded-[var(--radius-control)] border border-steel/30 bg-white px-3 py-2 text-sm text-ink hover:border-navy">
            খরচ
          </Link>
          <Link to="/reports/profit-loss" className="rounded-[var(--radius-control)] border border-steel/30 bg-white px-3 py-2 text-sm text-ink hover:border-navy">
            লাভ-ক্ষতি রিপোর্ট
          </Link>
        </div>
      )}
    </AppLayout>
  );
}

function StatCard({ label, value, valueClass, accent }: { label: string; value: string; valueClass?: string; accent: string }) {
  return (
    <div className={`rounded-[var(--radius-card)] border border-steel/20 border-l-4 ${accent} bg-white p-3`}>
      <p className="text-xs text-steel">{label}</p>
      <p className={`font-data text-lg font-semibold tabular-nums ${valueClass ?? 'text-ink'}`}>{value}</p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppLayout } from '../../components/AppLayout';
import { ExportBar } from '../../components/ExportBar';
import { fetchProductPerformance, type ProductPerformanceRow } from '../../lib/analytics';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function ProductPerformancePage() {
  const [rows, setRows] = useState<ProductPerformanceRow[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchProductPerformance(startDate || undefined, endDate || undefined)
      .then(setRows)
      .catch(() => setError('তথ্য লোড করা যায়নি।'))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const best = rows.slice(0, 10);
  const worst = [...rows].sort((a, b) => a.total_quantity - b.total_quantity).slice(0, 10);

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">পণ্য-পারফরম্যান্স — কী বেশি/কম বিক্রি হচ্ছে</h1>
      <p className="mb-5 text-sm text-steel">সব বিক্রয়-লাইন থেকে সরাসরি হিসাব করা — পরিমাণ অনুযায়ী সাজানো।</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy" />
        <span className="text-steel">থেকে</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy" />
        <div className="ml-auto">
          <ExportBar
            filename="product-performance"
            title="পণ্য-পারফরম্যান্স রিপোর্ট"
            subtitle={`${startDate || 'শুরু থেকে'} — ${endDate || 'এখন পর্যন্ত'}`}
            data={rows}
            columns={[
              { label: 'পণ্য', value: (r) => r.product_name },
              { label: 'মোট বিক্রিত পরিমাণ', value: (r) => r.total_quantity },
              { label: 'একক', value: (r) => r.unit },
              { label: 'মোট রাজস্ব', value: (r) => r.total_revenue },
            ]}
          />
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-steel">এই সময়সীমায় কোনো বিক্রয় নেই।</p>}

      {!loading && rows.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-success">সর্বোচ্চ বিক্রিত (শীর্ষ ১০)</h2>
            <div className="h-72 rounded-[var(--radius-card)] border border-steel/20 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={best} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="product_name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total_quantity" fill="var(--color-navy)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-warning">সর্বনিম্ন বিক্রিত (নিচের ১০)</h2>
            <div className="h-72 rounded-[var(--radius-card)] border border-steel/20 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={worst} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="product_name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total_quantity" fill="var(--color-crest-red)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-steel/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-white">
                <th className="px-3 py-2 font-medium">পণ্য</th>
                <th className="px-3 py-2 text-right font-medium">মোট বিক্রিত পরিমাণ</th>
                <th className="px-3 py-2 text-right font-medium">মোট রাজস্ব</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product_id} className="border-t border-steel/15">
                  <td className="px-3 py-2">{r.product_name}</td>
                  <td className="px-3 py-2 text-right font-data tabular-nums">{r.total_quantity} {r.unit}</td>
                  <td className="px-3 py-2 text-right font-data tabular-nums">{formatTaka(r.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}

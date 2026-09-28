import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { fetchExpiringBatches } from '../../lib/inventory';
import type { StockBatchRow } from '../../types/database.types';

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ExpiryAlertsPage() {
  const [batches, setBatches] = useState<StockBatchRow[]>([]);
  const [daysAhead, setDaysAhead] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchExpiringBatches(daysAhead)
      .then(setBatches)
      .catch(() => setError('তথ্য লোড করা যায়নি।'))
      .finally(() => setLoading(false));
  }, [daysAhead]);

  const expired = batches.filter((b) => daysUntil(b.expiry_date!) < 0);
  const soon = batches.filter((b) => daysUntil(b.expiry_date!) >= 0);

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">মেয়াদ-উত্তীর্ণ সতর্কতা</h1>
      <p className="mb-5 text-sm text-steel">
        প্রতিটা ক্রয়-ব্যাচের নিজস্ব মেয়াদ-তারিখ অনুযায়ী — একই পণ্যের ভিন্ন ব্যাচের ভিন্ন মেয়াদ হতে পারে।
      </p>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <label className="text-steel">কত দিনের মধ্যে দেখাবে:</label>
        <select
          value={daysAhead}
          onChange={(e) => setDaysAhead(Number(e.target.value))}
          className="rounded-[var(--radius-control)] border border-steel/30 px-2 py-1.5 outline-none focus-visible:border-navy"
        >
          <option value={7}>৭ দিন</option>
          <option value={15}>১৫ দিন</option>
          <option value={30}>৩০ দিন</option>
          <option value={90}>৯০ দিন</option>
        </select>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}
      {!loading && batches.length === 0 && <p className="text-sm text-steel">এই সীমার মধ্যে কোনো ব্যাচের মেয়াদ শেষ হচ্ছে না।</p>}

      {expired.length > 0 && (
        <div className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-danger">মেয়াদ শেষ হয়ে গেছে ({expired.length})</h2>
          <BatchTable rows={expired} />
        </div>
      )}
      {soon.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-warning">শীঘ্রই মেয়াদ শেষ হবে ({soon.length})</h2>
          <BatchTable rows={soon} />
        </div>
      )}
    </AppLayout>
  );
}

function BatchTable({ rows }: { rows: StockBatchRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-steel/20">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-navy text-left text-white">
            <th className="px-3 py-2 font-medium">পণ্য</th>
            <th className="px-3 py-2 font-medium">অবশিষ্ট পরিমাণ</th>
            <th className="px-3 py-2 font-medium">মেয়াদ-তারিখ</th>
            <th className="px-3 py-2 font-medium">অবস্থা</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const d = daysUntil(b.expiry_date!);
            return (
              <tr key={b.id} className="border-t border-steel/15 hover:bg-paper">
                <td className="px-3 py-2">
                  <Link to={`/inventory/${b.product_id}`} className="text-navy underline">
                    {b.products?.name ?? '—'}
                  </Link>
                </td>
                <td className="px-3 py-2 font-data tabular-nums">
                  {b.quantity_remaining} {b.products?.unit}
                </td>
                <td className="px-3 py-2 font-data tabular-nums">{formatDate(b.expiry_date!)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${d < 0 ? 'bg-danger/10 text-danger' : d <= 7 ? 'bg-warning/10 text-warning' : 'bg-steel/10 text-steel'}`}>
                    {d < 0 ? `${Math.abs(d)} দিন আগে শেষ` : d === 0 ? 'আজই শেষ' : `আর ${d} দিন`}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

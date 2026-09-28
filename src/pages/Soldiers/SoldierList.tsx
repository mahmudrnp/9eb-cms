import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { searchSoldiers } from '../../lib/soldiers';
import type { SoldierWithUnit } from '../../types/database.types';

const statusLabel: Record<string, string> = {
  active: 'সক্রিয়',
  transferred: 'বদলিকৃত',
  discharged: 'অব্যাহতিপ্রাপ্ত',
};

export function SoldierListPage() {
  const { profile } = useAuth();
  const canCreate = profile?.role === 'canteen_admin';

  const [queryText, setQueryText] = useState('');
  const [soldiers, setSoldiers] = useState<SoldierWithUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(q?: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await searchSoldiers({ query: q });
      setSoldiers(data);
    } catch {
      setError('সৈনিক-তালিকা লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    load(queryText.trim() || undefined);
  }

  return (
    <AppLayout>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">সৈনিক তালিকা</h1>
        <div className="flex gap-2">
          <Link
            to="/credit"
            className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm font-medium text-ink hover:bg-steel/10"
          >
            বকেয়া-আদায়
          </Link>
          {canCreate && (
            <Link
              to="/soldiers/import"
              className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm font-medium text-ink hover:bg-steel/10"
            >
              বাল্ক আমদানি
            </Link>
          )}
          {canCreate && (
            <Link
              to="/soldiers/new"
              className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-navy-hover)]"
            >
              + নতুন সৈনিক
            </Link>
          )}
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="সার্ভিস-নম্বর বা নাম দিয়ে খুঁজুন"
          className="w-full max-w-sm rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
        />
        <button
          type="submit"
          className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm font-medium text-ink hover:bg-steel/10"
        >
          খুঁজুন
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}

      {!loading && soldiers.length === 0 && (
        <p className="text-sm text-steel">
          {queryText ? 'কোনো সৈনিক পাওয়া যায়নি।' : 'এখনো কোনো সৈনিক যোগ করা হয়নি — উপরে "+ নতুন সৈনিক" থেকে শুরু করুন।'}
        </p>
      )}

      {!loading && soldiers.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-steel/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-white">
                <th className="px-3 py-2 font-medium">সার্ভিস#</th>
                <th className="px-3 py-2 font-medium">পদবি</th>
                <th className="px-3 py-2 font-medium">নাম</th>
                <th className="px-3 py-2 font-medium">কোম্পানি/প্লাটুন</th>
                <th className="px-3 py-2 font-medium">মোবাইল</th>
                <th className="px-3 py-2 font-medium">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody>
              {soldiers.map((s) => (
                <tr key={s.id} className="border-t border-steel/15 hover:bg-paper">
                  <td className="px-3 py-2 font-data tabular-nums">
                    <Link to={`/soldiers/${s.id}`} className="text-navy underline">
                      {s.service_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-steel">{s.rank}</td>
                  <td className="px-3 py-2">
                    <Link to={`/soldiers/${s.id}`} className="text-ink">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-steel">
                    {s.companies?.name ?? '—'}
                    {s.platoons?.name ? ` / ${s.platoons.name}` : ''}
                  </td>
                  <td className="px-3 py-2 font-data text-steel">{s.mobile_number ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        s.status === 'active'
                          ? 'bg-success/10 text-success'
                          : s.status === 'transferred'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {statusLabel[s.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}

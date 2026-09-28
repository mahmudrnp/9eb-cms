import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { fetchLoginEvents, type LoginEventFilters } from '../../lib/audit';
import type { LoginEventRow } from '../../types/database.types';

const eventLabel: Record<string, string> = {
  login_success: 'সফল লগইন',
  login_failed: 'ব্যর্থ লগইন',
  logout: 'লগআউট',
};

const eventColor: Record<string, string> = {
  login_success: 'text-success',
  login_failed: 'text-danger',
  logout: 'text-steel',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LoginHistoryPage() {
  const [rows, setRows] = useState<LoginEventRow[]>([]);
  const [filters, setFilters] = useState<LoginEventFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const offset = reset ? 0 : rows.length;
      const data = await fetchLoginEvents({ ...filters, offset });
      setRows(reset ? data : [...rows, ...data]);
      setHasMore(data.length === 100);
    } catch {
      setError('লগইন-ইতিহাস লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const failedCount = rows.filter((r) => r.event_type === 'login_failed').length;

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">লগইন ইতিহাস</h1>
      <p className="mb-5 text-sm text-steel">সব সফল/ব্যর্থ লগইন ও লগআউট ইভেন্ট — সন্দেহজনক-প্যাটার্ন শনাক্তে সহায়ক। শুধু Canteen Admin দেখতে পারে।</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={filters.startDate ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))}
          className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy"
        />
        <span className="text-steel">থেকে</span>
        <input
          type="date"
          value={filters.endDate ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))}
          className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data text-sm outline-none focus-visible:border-navy"
        />
        <select
          value={filters.eventType ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, eventType: (e.target.value || undefined) as LoginEventFilters['eventType'] }))
          }
          className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
        >
          <option value="">সব ধরন</option>
          <option value="login_success">সফল লগইন</option>
          <option value="login_failed">ব্যর্থ লগইন</option>
          <option value="logout">লগআউট</option>
        </select>
      </div>

      {failedCount > 0 && (
        <p className="mb-3 rounded-[var(--radius-control)] bg-danger/10 px-3 py-2 text-sm text-danger">
          এই তালিকায় {failedCount}টা ব্যর্থ-লগইন-চেষ্টা আছে — অপরিচিত প্যাটার্ন দেখলে পাসওয়ার্ড পরিবর্তনের পরামর্শ দিন।
        </p>
      )}

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && rows.length === 0 && <p className="text-sm text-steel">লোড হচ্ছে…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-steel">এই ফিল্টারে কোনো এন্ট্রি নেই।</p>}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-white">
                <th className="px-3 py-2 font-medium">সময়</th>
                <th className="px-3 py-2 font-medium">ইউজার/ইমেইল</th>
                <th className="px-3 py-2 font-medium">ধরন</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-steel/15">
                  <td className="px-3 py-2 font-data tabular-nums">{formatDateTime(r.created_at)}</td>
                  <td className="px-3 py-2">{r.profiles?.name ?? r.email_attempted ?? '—'}</td>
                  <td className={`px-3 py-2 font-medium ${eventColor[r.event_type]}`}>{eventLabel[r.event_type]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && hasMore && rows.length > 0 && (
        <button
          onClick={() => load(false)}
          className="mt-4 w-full rounded-[var(--radius-control)] border border-steel/40 py-2 text-sm font-medium text-navy hover:bg-steel/10"
        >
          আরও দেখুন
        </button>
      )}
      {loading && rows.length > 0 && <p className="mt-3 text-center text-sm text-steel">লোড হচ্ছে…</p>}
    </AppLayout>
  );
}

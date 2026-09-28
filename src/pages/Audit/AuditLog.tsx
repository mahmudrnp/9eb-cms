import { Fragment, useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { fetchAuditLogs, fetchDistinctAuditTables, type AuditLogFilters } from '../../lib/audit';
import type { AuditLogRow } from '../../types/database.types';

const actionLabel: Record<string, string> = {
  insert: 'তৈরি',
  update: 'সম্পাদনা',
  delete: 'মুছে ফেলা',
  export: 'এক্সপোর্ট',
};

const actionColor: Record<string, string> = {
  insert: 'text-success',
  update: 'text-warning',
  delete: 'text-danger',
  export: 'text-navy',
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

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const offset = reset ? 0 : rows.length;
      const data = await fetchAuditLogs({ ...filters, offset });
      setRows(reset ? data : [...rows, ...data]);
      setHasMore(data.length === 100);
    } catch {
      setError('অডিট-লগ লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDistinctAuditTables().then(setTables).catch(() => setTables([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">অডিট লগ — কার্যক্রম</h1>
      <p className="mb-5 text-sm text-steel">
        সব তৈরি/সম্পাদনা/মুছে-ফেলা/রিপোর্ট-এক্সপোর্ট কার্যক্রম, সময়ানুসারে (সাম্প্রতিক আগে)। শুধু Canteen Admin দেখতে পারে।
      </p>

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
          value={filters.action ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value || undefined }))}
          className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
        >
          <option value="">সব অ্যাকশন</option>
          <option value="insert">তৈরি</option>
          <option value="update">সম্পাদনা</option>
          <option value="delete">মুছে ফেলা</option>
          <option value="export">এক্সপোর্ট</option>
        </select>
        <select
          value={filters.tableName ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, tableName: e.target.value || undefined }))}
          className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
        >
          <option value="">সব টেবিল/রিপোর্ট</option>
          {tables.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && rows.length === 0 && <p className="text-sm text-steel">লোড হচ্ছে…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-steel">এই ফিল্টারে কোনো এন্ট্রি নেই।</p>}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-white">
                <th className="px-3 py-2 font-medium">সময়</th>
                <th className="px-3 py-2 font-medium">ইউজার</th>
                <th className="px-3 py-2 font-medium">অ্যাকশন</th>
                <th className="px-3 py-2 font-medium">টেবিল/রিপোর্ট</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    className="cursor-pointer border-t border-steel/15 hover:bg-paper"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <td className="px-3 py-2 font-data tabular-nums">{formatDateTime(r.created_at)}</td>
                    <td className="px-3 py-2">{r.profiles?.name ?? '—'}</td>
                    <td className={`px-3 py-2 font-medium ${actionColor[r.action] ?? 'text-ink'}`}>
                      {actionLabel[r.action] ?? r.action}
                    </td>
                    <td className="px-3 py-2 text-steel">{r.table_name}</td>
                    <td className="px-3 py-2 text-right text-xs text-navy underline">
                      {expandedId === r.id ? 'বন্ধ করুন' : 'বিস্তারিত'}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="border-t border-steel/10 bg-paper">
                      <td colSpan={5} className="px-3 py-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {r.before_value && (
                            <div>
                              <p className="mb-1 text-xs font-semibold text-steel">আগে</p>
                              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--radius-control)] bg-white p-2 font-data text-xs text-ink">
                                {JSON.stringify(r.before_value, null, 2)}
                              </pre>
                            </div>
                          )}
                          {r.after_value && (
                            <div>
                              <p className="mb-1 text-xs font-semibold text-steel">পরে</p>
                              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--radius-control)] bg-white p-2 font-data text-xs text-ink">
                                {JSON.stringify(r.after_value, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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

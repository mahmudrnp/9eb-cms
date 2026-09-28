import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import {
  createCorrectionEntry,
  fetchCorrectionEntries,
  TABLE_LABELS,
  TABLE_SEARCH,
} from '../../lib/corrections';
import { CORRECTABLE_TABLES, type CorrectableTable, type CorrectionEntryRow, type CorrectionType, type RecordOption } from '../../types/database.types';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RecordPicker({
  table,
  selected,
  onSelect,
  label,
}: {
  table: CorrectableTable;
  selected: RecordOption | null;
  onSelect: (r: RecordOption | null) => void;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<RecordOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    TABLE_SEARCH[table](query)
      .then((res) => {
        if (!cancelled) setOptions(res);
      })
      .catch(() => !cancelled && setOptions([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [table, query]);

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-steel">{label}</label>
      {selected ? (
        <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-navy/30 bg-navy/5 px-3 py-2 text-sm">
          <div>
            <p className="font-medium text-ink">{selected.label}</p>
            <p className="text-xs text-steel">{selected.sublabel}</p>
          </div>
          <button type="button" onClick={() => onSelect(null)} className="text-xs text-danger underline">
            পরিবর্তন
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="সার্চ করুন বা সাম্প্রতিক তালিকা থেকে বেছে নিন…"
            className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
          />
          {open && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-[var(--radius-control)] border border-steel/30 bg-white shadow-[var(--shadow-elevated)]">
              {loading && <p className="px-3 py-2 text-xs text-steel">লোড হচ্ছে…</p>}
              {!loading && options.length === 0 && <p className="px-3 py-2 text-xs text-steel">কোনো ফলাফল নেই</p>}
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onSelect(o);
                    setOpen(false);
                  }}
                  className="block w-full border-b border-steel/10 px-3 py-2 text-left text-sm hover:bg-paper"
                >
                  <p className="font-medium text-ink">{o.label}</p>
                  <p className="text-xs text-steel">{o.sublabel}</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CorrectionEntriesPage() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<CorrectionEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [originalTable, setOriginalTable] = useState<CorrectableTable>('sales');
  const [originalRecord, setOriginalRecord] = useState<RecordOption | null>(null);
  const [correctionType, setCorrectionType] = useState<CorrectionType>('adjustment');
  const [reason, setReason] = useState('');
  const [linkNew, setLinkNew] = useState(false);
  const [newTable, setNewTable] = useState<CorrectableTable>('stock_transactions');
  const [newRecord, setNewRecord] = useState<RecordOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setEntries(await fetchCorrectionEntries());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setOriginalRecord(null);
    setReason('');
    setCorrectionType('adjustment');
    setLinkNew(false);
    setNewRecord(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!originalRecord) {
      setFormError('মূল রেকর্ড নির্বাচন করুন।');
      return;
    }
    if (reason.trim().length < 10) {
      setFormError('কারণ কমপক্ষে ১০ অক্ষরে স্পষ্টভাবে লিখুন।');
      return;
    }
    if (linkNew && !newRecord) {
      setFormError('সংশোধনী-রেকর্ড নির্বাচন করুন, অথবা "নতুন রেকর্ড লিংক করুন" আনচেক করুন।');
      return;
    }
    setSaving(true);
    try {
      await createCorrectionEntry({
        originalTable,
        originalRecordId: originalRecord.id,
        reason: reason.trim(),
        correctionType,
        newReferenceTable: linkNew ? newTable : null,
        newReferenceId: linkNew ? newRecord!.id : null,
      });
      setShowForm(false);
      resetForm();
      await load();
    } catch {
      setFormError('সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  }

  if (profile && profile.role !== 'canteen_admin') {
    return (
      <AppLayout>
        <p className="text-sm text-danger">এই পাতা শুধু Canteen Admin-এর জন্য।</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">সংশোধনী-এন্ট্রি (Correction Entries)</h1>
        <button
          onClick={() => {
            setShowForm((s) => !s);
            if (showForm) resetForm();
          }}
          className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-hover"
        >
          {showForm ? 'বন্ধ করুন' : '+ নতুন সংশোধনী-এন্ট্রি'}
        </button>
      </div>
      <p className="mb-5 text-sm text-steel">
        কোনো লেনদেন কখনো সরাসরি এডিট/ডিলিট হয় না (Phase01 নীতি) — ভুল ধরা পড়লে এখানে একটা সংশোধনী-এন্ট্রি নথিভুক্ত করুন,
        এবং প্রকৃত সংশোধন (স্টক-সমন্বয়/নতুন পেমেন্ট/নতুন খরচ ইত্যাদি) সংশ্লিষ্ট মডিউল থেকে আলাদাভাবে তৈরি করে এখানে লিংক করুন।
      </p>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-[var(--radius-card)] border border-steel/20 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-steel">মূল রেকর্ড কোন টেবিলের</label>
            <select
              value={originalTable}
              onChange={(e) => {
                setOriginalTable(e.target.value as CorrectableTable);
                setOriginalRecord(null);
              }}
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
            >
              {CORRECTABLE_TABLES.map((t) => (
                <option key={t} value={t}>
                  {TABLE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <RecordPicker table={originalTable} selected={originalRecord} onSelect={setOriginalRecord} label="মূল রেকর্ড নির্বাচন করুন" />

          <div>
            <label className="mb-1 block text-xs font-medium text-steel">সংশোধনী-ধরন</label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={correctionType === 'adjustment'} onChange={() => setCorrectionType('adjustment')} />
                সমন্বয় (Adjustment)
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={correctionType === 'reversal'} onChange={() => setCorrectionType('reversal')} />
                বিপরীত-এন্ট্রি (Reversal)
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-steel">কারণ (বাধ্যতামূলক, স্পষ্টভাবে লিখুন)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
              placeholder="যেমন: ভুল পণ্যে বিক্রয় এন্ট্রি হয়েছিল, স্টক-সমন্বয় TXN-এ সংশোধন করা হলো"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={linkNew} onChange={(e) => setLinkNew(e.target.checked)} />
              প্রকৃত সংশোধনী-রেকর্ড ইতিমধ্যে তৈরি করেছেন? এখানে লিংক করুন (ঐচ্ছিক)
            </label>
          </div>

          {linkNew && (
            <div className="space-y-3 rounded-[var(--radius-control)] bg-paper p-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-steel">নতুন রেকর্ড কোন টেবিলের</label>
                <select
                  value={newTable}
                  onChange={(e) => {
                    setNewTable(e.target.value as CorrectableTable);
                    setNewRecord(null);
                  }}
                  className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
                >
                  {CORRECTABLE_TABLES.map((t) => (
                    <option key={t} value={t}>
                      {TABLE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <RecordPicker table={newTable} selected={newRecord} onSelect={setNewRecord} label="সংশোধনী-রেকর্ড নির্বাচন করুন" />
            </div>
          )}

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-[var(--radius-control)] bg-navy py-2.5 text-sm font-medium text-white hover:bg-navy-hover disabled:opacity-50"
          >
            {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংশোধনী-এন্ট্রি সংরক্ষণ করুন'}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}
      {!loading && entries.length === 0 && <p className="text-sm text-steel">এখনো কোনো সংশোধনী-এন্ট্রি নেই।</p>}

      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className={`font-medium ${e.correction_type === 'reversal' ? 'text-danger' : 'text-warning'}`}>
                  {e.correction_type === 'reversal' ? 'বিপরীত-এন্ট্রি' : 'সমন্বয়'} — {TABLE_LABELS[e.original_table as CorrectableTable] ?? e.original_table}
                </span>
                <span className="font-data text-xs tabular-nums text-steel">{formatDateTime(e.created_at)}</span>
              </div>
              <p className="text-ink">{e.reason}</p>
              <p className="mt-1 text-xs text-steel">
                {e.profiles?.name ?? '—'} কর্তৃক
                {e.new_reference_table && ` · সংশোধনী-রেফারেন্স: ${TABLE_LABELS[e.new_reference_table as CorrectableTable] ?? e.new_reference_table}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

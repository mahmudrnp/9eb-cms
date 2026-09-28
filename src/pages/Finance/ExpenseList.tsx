import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { fetchExpenses, createExpense } from '../../lib/finance';
import { ExportBar } from '../../components/ExportBar';
import type { Expense } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ExpenseListPage() {
  const { profile } = useAuth();
  const canCreate = profile?.role === 'canteen_admin';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setExpenses(await fetchExpenses());
    } catch {
      setError('খরচের তালিকা লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setFormError(null);
    setSaving(true);
    try {
      await createExpense({
        category: category.trim(),
        amount: Number(amount),
        expenseDate: expenseDate,
        description: description.trim() || null,
        recordedBy: profile.id,
      });
      setCategory('');
      setAmount('');
      setDescription('');
      setShowForm(false);
      await load();
    } catch {
      setFormError('সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <AppLayout>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">খরচ</h1>
        {canCreate && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-navy-hover)]"
          >
            + নতুন খরচ
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 max-w-md rounded-[var(--radius-card)] border border-steel/20 bg-white p-4">
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-ink">ক্যাটাগরি *</label>
            <input
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="যেমন: বিদ্যুৎ, ভাড়া, মজুরি"
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
            />
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">পরিমাণ (৳) *</label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">তারিখ *</label>
              <input
                required
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-ink">বিবরণ (ঐচ্ছিক)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
            />
          </div>
          {formError && <p className="mb-3 text-sm text-danger">{formError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm text-ink">
              বাতিল
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}

      {!loading && expenses.length > 0 && (
        <div className="mb-3">
          <ExportBar
            filename="expenses-report"
            title="খরচ রিপোর্ট (Expenses)"
            subtitle={`সাম্প্রতিক ${expenses.length}টা খরচ, সমষ্টি ${formatTaka(total)}`}
            data={expenses}
            columns={[
              { label: 'তারিখ', value: (e) => formatDate(e.expense_date) },
              { label: 'ক্যাটাগরি', value: (e) => e.category },
              { label: 'পরিমাণ', value: (e) => e.amount },
              { label: 'বিবরণ', value: (e) => e.description ?? '' },
            ]}
          />
        </div>
      )}

      {!loading && expenses.length > 0 && (
        <p className="mb-3 text-sm text-steel">
          সাম্প্রতিক ২০০টা খরচের সমষ্টি: <span className="font-data font-medium text-ink">{formatTaka(total)}</span>
        </p>
      )}

      {!loading && expenses.length === 0 && <p className="text-sm text-steel">এখনো কোনো খরচ রেকর্ড করা হয়নি।</p>}

      {!loading && expenses.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
          {expenses.map((e, idx) => (
            <div key={e.id} className={`flex items-center justify-between px-3 py-2.5 text-sm ${idx !== expenses.length - 1 ? 'border-b border-steel/10' : ''}`}>
              <div>
                <p className="text-ink">{e.category}</p>
                <p className="text-xs text-steel">
                  {formatDate(e.expense_date)}
                  {e.description ? ` · ${e.description}` : ''}
                </p>
              </div>
              <p className="font-data tabular-nums text-danger">−{formatTaka(e.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

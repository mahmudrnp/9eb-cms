import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { searchProducts, fetchCategories } from '../../lib/inventory';
import { ExportBar } from '../../components/ExportBar';
import type { ProductWithStock, Category } from '../../types/database.types';

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function ProductListPage() {
  const { profile } = useAuth();
  const canCreate = profile?.role === 'canteen_admin';

  const [queryText, setQueryText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cats, prods] = await Promise.all([
        categories.length ? Promise.resolve(categories) : fetchCategories(),
        searchProducts({
          query: queryText.trim() || undefined,
          categoryId: categoryId || undefined,
          lowStockOnly,
        }),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch {
      setError('পণ্য-তালিকা লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    load();
  }

  const lowStockCount = products.filter((p) => p.is_low_stock).length;

  return (
    <AppLayout>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">ইনভেন্টরি</h1>
        {canCreate && (
          <Link
            to="/inventory/new"
            className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-navy-hover)]"
          >
            + নতুন পণ্য
          </Link>
        )}
      </div>

      {lowStockCount > 0 && (
        <p className="mb-3 rounded-[var(--radius-control)] bg-warning/10 px-3 py-2 text-sm text-warning">
          ⚠ {lowStockCount}টা পণ্য লো-স্টকে আছে
        </p>
      )}

      <form onSubmit={handleSearch} className="mb-4 flex flex-wrap gap-2">
        <input
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="পণ্যের নাম বা SKU"
          className="w-full max-w-xs rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 text-sm outline-none focus-visible:border-navy"
        >
          <option value="">সব ক্যাটাগরি</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          শুধু লো-স্টক
        </label>
        <button
          type="submit"
          className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm font-medium text-ink hover:bg-steel/10"
        >
          খুঁজুন
        </button>
      </form>

      {!loading && products.length > 0 && (
        <div className="mb-3">
          <ExportBar
            filename="inventory-stock-report"
            title="ইনভেন্টরি / স্টক রিপোর্ট"
            subtitle={`মোট ${products.length}টা পণ্য`}
            data={products}
            columns={[
              { label: 'পণ্য', value: (p) => p.name },
              { label: 'SKU', value: (p) => p.sku ?? '' },
              { label: 'ক্যাটাগরি', value: (p) => p.categories?.name ?? '' },
              { label: 'একক', value: (p) => p.unit },
              { label: 'ক্রয়-মূল্য', value: (p) => p.purchase_price },
              { label: 'বিক্রয়-মূল্য', value: (p) => p.selling_price },
              { label: 'বর্তমান স্টক', value: (p) => p.current_qty },
              { label: 'লো-স্টক', value: (p) => (p.is_low_stock ? 'হ্যাঁ' : 'না') },
            ]}
          />
        </div>
      )}

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}

      {!loading && products.length === 0 && (
        <p className="text-sm text-steel">
          {queryText || categoryId || lowStockOnly
            ? 'কোনো পণ্য পাওয়া যায়নি।'
            : 'এখনো কোনো পণ্য যোগ করা হয়নি — উপরে "+ নতুন পণ্য" থেকে শুরু করুন।'}
        </p>
      )}

      {!loading && products.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-steel/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-white">
                <th className="px-3 py-2 font-medium">পণ্য</th>
                <th className="px-3 py-2 font-medium">ক্যাটাগরি</th>
                <th className="px-3 py-2 text-right font-medium">বিক্রয়-মূল্য</th>
                <th className="px-3 py-2 text-right font-medium">স্টক</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-steel/15 hover:bg-paper">
                  <td className="px-3 py-2">
                    <Link to={`/inventory/${p.id}`} className="text-navy underline">
                      {p.name}
                    </Link>
                    {p.sku && <span className="ml-1.5 font-data text-xs text-steel">({p.sku})</span>}
                  </td>
                  <td className="px-3 py-2 text-steel">{p.categories?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-data tabular-nums">{formatTaka(p.selling_price)}</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`font-data tabular-nums ${p.is_low_stock ? 'font-semibold text-warning' : 'text-ink'}`}
                    >
                      {p.current_qty} {p.unit}
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

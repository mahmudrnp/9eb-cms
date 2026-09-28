import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import {
  fetchCategories,
  createCategory,
  fetchSuppliers,
  createSupplier,
  fetchProduct,
  createProduct,
  updateProduct,
} from '../../lib/inventory';
import type { Category, Supplier, ProductStatus } from '../../types/database.types';

export function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('পিস');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [openingStock, setOpeningStock] = useState('0');
  const [minStockLevel, setMinStockLevel] = useState('0');
  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState<ProductStatus>('active');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockEditWarning, setStockEditWarning] = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [cats, sups] = await Promise.all([fetchCategories(), fetchSuppliers()]);
        setCategories(cats);
        setSuppliers(sups);
        if (isEdit && id) {
          const product = await fetchProduct(id);
          if (product) {
            setName(product.name);
            setSku(product.sku ?? '');
            setCategoryId(product.category_id ?? '');
            setUnit(product.unit);
            setPurchasePrice(String(product.purchase_price));
            setSellingPrice(String(product.selling_price));
            setOpeningStock(String(product.opening_stock));
            setMinStockLevel(String(product.min_stock_level));
            setSupplierId(product.supplier_id ?? '');
            setStatus(product.status);
          }
        }
      } catch {
        setError('তথ্য লোড করা যায়নি।');
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    const created = await createCategory(newCategoryName.trim());
    setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId(created.id);
    setNewCategoryName('');
    setShowNewCategory(false);
  }

  async function handleAddSupplier() {
    if (!newSupplierName.trim()) return;
    const created = await createSupplier(newSupplierName.trim());
    setSuppliers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setSupplierId(created.id);
    setNewSupplierName('');
    setShowNewSupplier(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        sku: sku.trim() || null,
        category_id: categoryId || null,
        unit: unit.trim(),
        purchase_price: Number(purchasePrice),
        selling_price: Number(sellingPrice),
        opening_stock: Number(openingStock),
        min_stock_level: Number(minStockLevel),
        supplier_id: supplierId || null,
        status,
      };
      const saved = isEdit && id ? await updateProduct(id, input) : await createProduct(input);
      navigate(`/inventory/${saved.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('duplicate') || message.includes('unique')) {
        setError('এই SKU ইতিমধ্যে ব্যবহৃত হয়েছে — অনুগ্রহ করে যাচাই করুন।');
      } else {
        setError('সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm text-steel">লোড হচ্ছে…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-5 text-lg font-semibold text-ink">
        {isEdit ? 'পণ্য সম্পাদনা' : 'নতুন পণ্য যোগ করুন'}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-lg rounded-[var(--radius-card)] border border-steel/20 bg-white p-5"
      >
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink">পণ্যের নাম *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">SKU (ঐচ্ছিক)</label>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">একক *</label>
            <input
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="পিস/কেজি/লিটার"
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink">ক্যাটাগরি</label>
          {!showNewCategory ? (
            <div className="flex gap-2">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
              >
                <option value="">— নির্বাচন করুন —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewCategory(true)}
                className="whitespace-nowrap rounded-[var(--radius-control)] border border-steel/40 px-3 py-2 text-sm text-ink hover:bg-steel/10"
              >
                + নতুন
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="নতুন ক্যাটাগরির নাম"
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="whitespace-nowrap rounded-[var(--radius-control)] bg-navy px-3 py-2 text-sm text-white"
              >
                যোগ করুন
              </button>
              <button
                type="button"
                onClick={() => setShowNewCategory(false)}
                className="whitespace-nowrap rounded-[var(--radius-control)] border border-steel/40 px-3 py-2 text-sm text-ink"
              >
                বাতিল
              </button>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink">সরবরাহকারী (ঐচ্ছিক)</label>
          {!showNewSupplier ? (
            <div className="flex gap-2">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
              >
                <option value="">— নির্বাচন করুন —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewSupplier(true)}
                className="whitespace-nowrap rounded-[var(--radius-control)] border border-steel/40 px-3 py-2 text-sm text-ink hover:bg-steel/10"
              >
                + নতুন
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="নতুন সরবরাহকারীর নাম"
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
              />
              <button
                type="button"
                onClick={handleAddSupplier}
                className="whitespace-nowrap rounded-[var(--radius-control)] bg-navy px-3 py-2 text-sm text-white"
              >
                যোগ করুন
              </button>
              <button
                type="button"
                onClick={() => setShowNewSupplier(false)}
                className="whitespace-nowrap rounded-[var(--radius-control)] border border-steel/40 px-3 py-2 text-sm text-ink"
              >
                বাতিল
              </button>
            </div>
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">ক্রয়-মূল্য (৳) *</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">বিক্রয়-মূল্য (৳) *</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
            />
            <p className="mt-1 text-xs text-steel">Phase01 নীতি: ফিক্সড রেট, বাজার-মূল্য না</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              ওপেনিং স্টক {isEdit && '(সতর্কতা নিচে দেখুন)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingStock}
              onChange={(e) => {
                setOpeningStock(e.target.value);
                if (isEdit) setStockEditWarning(true);
              }}
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">ন্যূনতম-স্তর (লো-স্টক অ্যালার্ট)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={minStockLevel}
              onChange={(e) => setMinStockLevel(e.target.value)}
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
            />
          </div>
        </div>

        {stockEditWarning && (
          <p className="mb-4 rounded-[var(--radius-control)] bg-warning/10 px-3 py-2 text-xs text-warning">
            ⚠ Phase02 নীতি: বর্তমান-স্টক শুধু stock_transactions থেকে গণনা হয়, এই ওপেনিং-স্টক-মান
            শুধু প্রাথমিক বেসলাইন — পরিমাণ ঠিক করতে হলে স্টক-হিস্ট্রি পাতা থেকে "সমন্বয়-এন্ট্রি" ব্যবহার করুন।
          </p>
        )}

        <div className="mb-5">
          <label className="mb-1 block text-sm font-medium text-ink">স্ট্যাটাস</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductStatus)}
            className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
          >
            <option value="active">সক্রিয়</option>
            <option value="discontinued">বন্ধ</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-[var(--radius-control)] bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[var(--radius-control)] bg-navy px-4 py-2.5 font-medium text-white hover:bg-[var(--color-navy-hover)] disabled:opacity-60"
          >
            {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2.5 font-medium text-ink"
          >
            বাতিল
          </button>
        </div>
      </form>
    </AppLayout>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { fetchSuppliersWithPayable, createPurchaseWithItems } from '../../lib/purchases';
import { fetchActiveProductsBasic, createSupplier, type ProductBasic } from '../../lib/inventory';
import type { SupplierWithPayable, PurchasePaymentStatus } from '../../types/database.types';

interface LineRow {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
  expiryDate: string;
}

let rowKeySeq = 0;
function emptyRow(): LineRow {
  return { key: rowKeySeq++, productId: '', quantity: '', unitCost: '', expiryDate: '' };
}

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function PurchaseFormPage() {
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<SupplierWithPayable[]>([]);
  const [products, setProducts] = useState<ProductBasic[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState<PurchasePaymentStatus>('due');
  const [remarks, setRemarks] = useState('');
  const [rows, setRows] = useState<LineRow[]>([emptyRow()]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSuppliersWithPayable(), fetchActiveProductsBasic()])
      .then(([s, p]) => {
        setSuppliers(s);
        setProducts(p);
      })
      .catch(() => setError('তথ্য লোড করা যায়নি।'))
      .finally(() => setLoading(false));
  }, []);

  async function handleAddSupplier() {
    if (!newSupplierName.trim()) return;
    const created = await createSupplier(newSupplierName.trim());
    setSuppliers((prev) => [{ ...created, outstanding_payable: 0 }, ...prev]);
    setSupplierId(created.id);
    setNewSupplierName('');
    setShowNewSupplier(false);
  }

  function updateRow(key: number, patch: Partial<LineRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, ...patch };
        // পণ্য বাছাই করলে ডিফল্ট unit_cost পণ্যের নিজস্ব ক্রয়-মূল্য দিয়ে পূরণ (পরিবর্তনযোগ্য)
        if (patch.productId && !r.unitCost) {
          const p = products.find((pr) => pr.id === patch.productId);
          if (p) updated.unitCost = String(p.purchase_price);
        }
        return updated;
      })
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  const total = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitCost) || 0), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const items = rows
      .filter((r) => r.productId && Number(r.quantity) > 0)
      .map((r) => ({
        product_id: r.productId,
        quantity: Number(r.quantity),
        unit_cost: Number(r.unitCost) || 0,
        expiry_date: r.expiryDate || null,
      }));

    if (!supplierId) {
      setError('সরবরাহকারী নির্বাচন করুন।');
      return;
    }
    if (items.length === 0) {
      setError('অন্তত একটা পণ্য-লাইন সঠিকভাবে পূরণ করুন।');
      return;
    }

    setSaving(true);
    try {
      const purchaseId = await createPurchaseWithItems({
        supplierId,
        invoiceRef: invoiceRef.trim() || null,
        purchaseDate,
        paymentStatus,
        remarks: remarks.trim() || null,
        items,
      });
      navigate(`/purchases/${purchaseId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('create_purchase_with_items') || message.includes('function')) {
        setError(
          'ক্রয়-এন্ট্রি সংরক্ষণ করা যায়নি — supabase/phase07_functions.sql রান করা হয়েছে কিনা যাচাই করুন।'
        );
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
      <h1 className="mb-5 text-lg font-semibold text-ink">নতুন ক্রয়-এন্ট্রি</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl rounded-[var(--radius-card)] border border-steel/20 bg-white p-5">
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink">সরবরাহকারী *</label>
          {!showNewSupplier ? (
            <div className="flex gap-2">
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy"
              >
                <option value="">— নির্বাচন করুন —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewSupplier(true)} className="whitespace-nowrap rounded-[var(--radius-control)] border border-steel/40 px-3 py-2 text-sm text-ink hover:bg-steel/10">
                + নতুন
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="নতুন সরবরাহকারীর নাম" className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy" />
              <button type="button" onClick={handleAddSupplier} className="whitespace-nowrap rounded-[var(--radius-control)] bg-navy px-3 py-2 text-sm text-white">যোগ করুন</button>
              <button type="button" onClick={() => setShowNewSupplier(false)} className="whitespace-nowrap rounded-[var(--radius-control)] border border-steel/40 px-3 py-2 text-sm text-ink">বাতিল</button>
            </div>
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">ইনভয়েস/রেফারেন্স</label>
            <input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">তারিখ *</label>
            <input required type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy" />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink">পেমেন্ট-স্ট্যাটাস</label>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PurchasePaymentStatus)} className="w-full max-w-xs rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy">
            <option value="due">বাকি (সরবরাহকারীর কাছে payable তৈরি হবে)</option>
            <option value="partial">আংশিক</option>
            <option value="paid">পরিশোধিত</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-ink">পণ্য-লাইন *</label>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.key} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1">
                  <select
                    value={row.productId}
                    onChange={(e) => updateRow(row.key, { productId: e.target.value })}
                    className="w-full rounded-[var(--radius-control)] border border-steel/30 px-2 py-2 text-sm outline-none focus-visible:border-navy"
                  >
                    <option value="">পণ্য নির্বাচন</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                    ))}
                  </select>
                </div>
                <input
                  type="number" min="0.01" step="0.01" placeholder="পরিমাণ"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  className="w-24 rounded-[var(--radius-control)] border border-steel/30 px-2 py-2 font-data text-sm outline-none focus-visible:border-navy"
                />
                <input
                  type="number" min="0" step="0.01" placeholder="একক-মূল্য"
                  value={row.unitCost}
                  onChange={(e) => updateRow(row.key, { unitCost: e.target.value })}
                  className="w-28 rounded-[var(--radius-control)] border border-steel/30 px-2 py-2 font-data text-sm outline-none focus-visible:border-navy"
                />
                <div>
                  <input
                    type="date" title="মেয়াদ-উত্তীর্ণ তারিখ (ঐচ্ছিক)"
                    value={row.expiryDate}
                    onChange={(e) => updateRow(row.key, { expiryDate: e.target.value })}
                    className="w-36 rounded-[var(--radius-control)] border border-steel/30 px-2 py-2 font-data text-sm outline-none focus-visible:border-navy"
                  />
                </div>
                <button type="button" onClick={() => removeRow(row.key)} className="rounded-[var(--radius-control)] border border-steel/40 px-2.5 py-2 text-sm text-danger">✕</button>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-steel">মেয়াদ-তারিখ (শেষ কলাম) ঐচ্ছিক — পচনশীল পণ্য না হলে খালি রাখুন।</p>
          <button type="button" onClick={addRow} className="mt-2 text-sm font-medium text-navy underline">+ আরেকটা লাইন যোগ করুন</button>
        </div>

        <p className="mb-4 font-data text-lg font-semibold tabular-nums text-ink">মোট: {formatTaka(total)}</p>

        <div className="mb-5">
          <label className="mb-1 block text-sm font-medium text-ink">মন্তব্য (ঐচ্ছিক)</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 outline-none focus-visible:border-navy" />
        </div>

        {error && <p role="alert" className="mb-4 rounded-[var(--radius-control)] bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="rounded-[var(--radius-control)] bg-navy px-4 py-2.5 font-medium text-white hover:bg-[var(--color-navy-hover)] disabled:opacity-60">
            {saving ? 'সংরক্ষণ হচ্ছে…' : 'ক্রয় নিশ্চিত করুন'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2.5 font-medium text-ink">বাতিল</button>
        </div>
      </form>
    </AppLayout>
  );
}

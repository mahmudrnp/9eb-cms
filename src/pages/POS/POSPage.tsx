import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { QrScanner } from '../../components/QrScanner';
import { useAuth } from '../../contexts/AuthContext';
import { searchSoldiers } from '../../lib/soldiers';
import { fetchProductsForPOS, fetchProductForPOSById, createSale } from '../../lib/sales';
import type { SoldierWithUnit, ProductForPOS, PaymentType } from '../../types/database.types';

interface CartLine {
  product: ProductForPOS;
  quantity: number;
}

function formatTaka(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function POSPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'canteen_admin';

  // সৈনিক-সার্চ
  const [soldierQuery, setSoldierQuery] = useState('');
  const [soldierResults, setSoldierResults] = useState<SoldierWithUnit[]>([]);
  const [selectedSoldier, setSelectedSoldier] = useState<SoldierWithUnit | null>(null);

  // পণ্য-সার্চ
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<ProductForPOS[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [discountAmount, setDiscountAmount] = useState('0');
  const [paymentType, setPaymentType] = useState<PaymentType>('cash');
  const [partialPaid, setPartialPaid] = useState('');
  const [overrideApplied, setOverrideApplied] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<{ id: string; receiptNo: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (soldierQuery.trim()) {
        searchSoldiers({ query: soldierQuery.trim(), status: 'active' }).then(setSoldierResults);
      } else {
        setSoldierResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [soldierQuery]);

  useEffect(() => {
    fetchProductsForPOS(productQuery.trim() || undefined).then(setProductResults);
  }, [productQuery]);

  function addToCart(product: ProductForPOS) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  // Phase18: QR-লেবেল স্ক্যান করে সরাসরি কার্টে যোগ — 9EBCMS:PRODUCT:<id> ফরম্যাট প্রত্যাশিত
  async function handleQrDetect(payload: string) {
    setScannerOpen(false);
    const match = payload.match(/^9EBCMS:PRODUCT:(.+)$/);
    if (!match) {
      setScanMessage('অচেনা QR কোড — এটা এই অ্যাপের পণ্য-লেবেল না।');
      return;
    }
    const product = await fetchProductForPOSById(match[1]);
    if (!product) {
      setScanMessage('এই QR-এর পণ্য খুঁজে পাওয়া যায়নি (নিষ্ক্রিয় বা মুছে ফেলা হতে পারে)।');
      return;
    }
    addToCart(product);
    setScanMessage(`✓ ${product.name} কার্টে যোগ হয়েছে`);
    setTimeout(() => setScanMessage(null), 2500);
  }

  function updateQty(productId: string, qty: number) {
    setCart((prev) =>
      qty <= 0 ? prev.filter((l) => l.product.id !== productId) : prev.map((l) => (l.product.id === productId ? { ...l, quantity: qty } : l))
    );
  }

  const subtotal = cart.reduce((sum, l) => sum + l.quantity * l.product.selling_price, 0);
  const discount = isAdmin ? Number(discountAmount) || 0 : 0;
  const total = Math.max(0, subtotal - discount);

  const stockIssues = cart.filter((l) => l.quantity > l.product.current_qty);
  const hasStockIssue = stockIssues.length > 0;

  function resetForm() {
    setSelectedSoldier(null);
    setSoldierQuery('');
    setCart([]);
    setDiscountAmount('0');
    setPaymentType('cash');
    setPartialPaid('');
    setOverrideApplied(false);
  }

  async function handleConfirm() {
    setError(null);
    if (!selectedSoldier) {
      setError('সৈনিক নির্বাচন করুন।');
      return;
    }
    if (cart.length === 0) {
      setError('অন্তত একটা পণ্য কার্টে যোগ করুন।');
      return;
    }
    if (hasStockIssue && !overrideApplied) {
      setError('স্টক অপর্যাপ্ত — override নিশ্চিত না করলে বিক্রয় সম্পন্ন হবে না।');
      return;
    }
    if (paymentType === 'partial' && (!partialPaid || Number(partialPaid) <= 0 || Number(partialPaid) >= total)) {
      setError('আংশিক-পেমেন্টের পরিমাণ ০ থেকে মোটের মধ্যে হতে হবে।');
      return;
    }

    setSubmitting(true);
    try {
      const saleId = await createSale({
        soldierId: selectedSoldier.id,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity, unit_price: l.product.selling_price })),
        discountAmount: discount,
        discountApprovedBy: discount > 0 ? profile!.id : null,
        paymentType,
        partialPaidAmount: paymentType === 'partial' ? Number(partialPaid) : 0,
        overrideApplied,
      });
      // রসিদ-নম্বর জানতে সংক্ষিপ্তভাবে fetch — চূড়ান্ত UI receipt পাতায় পূর্ণ দেখাবে
      setSuccessReceipt({ id: saleId, receiptNo: '' });
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('ঋণাত্মক') || message.includes('negative')) {
        setError('স্টক ঋণাত্মক হয়ে যাবে — override-চেকবক্স টিক দিন।');
      } else if (message.includes('ডিসকাউন্ট')) {
        setError('ডিসকাউন্ট অনুমোদনে সমস্যা।');
      } else if (message.includes('function') || message.includes('create_sale_with_items')) {
        setError('বিক্রয় সংরক্ষণ করা যায়নি — supabase/phase08_functions.sql রান করা হয়েছে কিনা যাচাই করুন।');
      } else {
        setError('বিক্রয় সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (successReceipt) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-sm rounded-[var(--radius-card)] border border-success/30 bg-success/5 p-6 text-center">
          <p className="mb-1 text-2xl">✓</p>
          <p className="mb-1 font-semibold text-ink">বিক্রয় সম্পন্ন হয়েছে</p>
          <p className="mb-4 text-sm text-steel">রসিদ সংরক্ষিত হয়েছে — বিস্তারিত দেখতে নিচে ক্লিক করুন।</p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => navigate(`/sales/${successReceipt.id}`)}
              className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white"
            >
              রসিদ দেখুন
            </button>
            <button
              onClick={() => setSuccessReceipt(null)}
              className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2 text-sm text-ink"
            >
              নতুন বিক্রয়
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">POS — বিক্রয়</h1>
        <Link to="/sales" className="text-sm text-navy underline">
          সাম্প্রতিক বিক্রয়
        </Link>
      </div>

      {/* সৈনিক নির্বাচন */}
      <div className="mb-4">
        {selectedSoldier ? (
          <div className="flex items-center justify-between rounded-[var(--radius-card)] border border-navy/30 bg-navy/5 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-ink">{selectedSoldier.name}</p>
              <p className="text-xs text-steel">সার্ভিস#{selectedSoldier.service_id} · {selectedSoldier.rank}</p>
            </div>
            <button onClick={() => setSelectedSoldier(null)} className="text-sm text-navy underline">
              পরিবর্তন
            </button>
          </div>
        ) : (
          <div>
            <input
              value={soldierQuery}
              onChange={(e) => setSoldierQuery(e.target.value)}
              placeholder="🔍 সৈনিক খুঁজুন (সার্ভিস-নম্বর/নাম)"
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2.5 outline-none focus-visible:border-navy"
            />
            {soldierResults.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-[var(--radius-control)] border border-steel/20 bg-white">
                {soldierResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSoldier(s);
                      setSoldierResults([]);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-paper"
                  >
                    {s.name} <span className="text-steel">· সার্ভিস#{s.service_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* পণ্য নির্বাচন */}
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="🔍 পণ্য খুঁজুন"
            className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2.5 outline-none focus-visible:border-navy"
          />
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="whitespace-nowrap rounded-[var(--radius-control)] border border-navy/40 px-3 py-2.5 text-sm font-medium text-navy hover:bg-navy/5"
          >
            📷 QR স্ক্যান
          </button>
        </div>
        {scanMessage && <p className="mt-1 text-xs text-steel">{scanMessage}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {productResults.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.current_qty <= 0}
              className="rounded-[var(--radius-control)] border border-steel/30 bg-white px-3 py-1.5 text-sm text-ink hover:border-navy disabled:opacity-40"
            >
              {p.name} — {formatTaka(p.selling_price)}
              {p.current_qty <= 0 && <span className="ml-1 text-danger">(স্টক নেই)</span>}
            </button>
          ))}
        </div>
      </div>

      {scannerOpen && <QrScanner onDetect={handleQrDetect} onClose={() => setScannerOpen(false)} />}

      {/* কার্ট */}
      {cart.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
          {cart.map((line, idx) => {
            const insufficient = line.quantity > line.product.current_qty;
            return (
              <div
                key={line.product.id}
                className={`flex items-center justify-between px-3 py-2 text-sm ${idx !== cart.length - 1 ? 'border-b border-steel/10' : ''}`}
              >
                <div>
                  <p className="text-ink">{line.product.name}</p>
                  {insufficient && (
                    <p className="text-xs text-danger">স্টকে আছে মাত্র {line.product.current_qty} {line.product.unit}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(line.product.id, line.quantity - 1)} className="h-7 w-7 rounded-[var(--radius-control)] border border-steel/30 text-ink">−</button>
                  <span className="w-6 text-center font-data tabular-nums">{line.quantity}</span>
                  <button onClick={() => updateQty(line.product.id, line.quantity + 1)} className="h-7 w-7 rounded-[var(--radius-control)] border border-steel/30 text-ink">+</button>
                  <span className="w-16 text-right font-data tabular-nums">{formatTaka(line.quantity * line.product.selling_price)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasStockIssue && isAdmin && (
        <label className="mb-3 flex items-center gap-1.5 text-sm text-warning">
          <input type="checkbox" checked={overrideApplied} onChange={(e) => setOverrideApplied(e.target.checked)} />
          ঋণাত্মক-স্টক override করুন (অডিট-লগে রেকর্ড হবে)
        </label>
      )}
      {hasStockIssue && !isAdmin && (
        <p className="mb-3 text-sm text-danger">স্টক অপর্যাপ্ত — override করতে Canteen Admin প্রয়োজন।</p>
      )}

      {isAdmin && cart.length > 0 && (
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-ink">ডিসকাউন্ট (৳)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            className="w-32 rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
          />
        </div>
      )}

      {cart.length > 0 && (
        <>
          <div className="mb-3 rounded-[var(--radius-card)] border border-steel/20 bg-white p-3">
            <div className="flex justify-between text-sm text-steel">
              <span>সাবটোটাল</span>
              <span className="font-data tabular-nums">{formatTaka(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-steel">
                <span>ডিসকাউন্ট</span>
                <span className="font-data tabular-nums">−{formatTaka(discount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-steel/15 pt-1 font-semibold text-ink">
              <span>মোট</span>
              <span className="font-data tabular-nums">{formatTaka(total)}</span>
            </div>
          </div>

          <div className="mb-3 flex gap-2">
            {(['cash', 'credit', 'partial'] as PaymentType[]).map((t) => (
              <button
                key={t}
                onClick={() => setPaymentType(t)}
                className={`flex-1 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium ${
                  paymentType === t ? 'border-navy bg-navy text-white' : 'border-steel/30 text-ink'
                }`}
              >
                {t === 'cash' ? 'নগদ' : t === 'credit' ? 'বাকি' : 'আংশিক'}
              </button>
            ))}
          </div>

          {paymentType === 'partial' && (
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-ink">এখন পরিশোধিত (৳)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={partialPaid}
                onChange={(e) => setPartialPaid(e.target.value)}
                className="w-32 rounded-[var(--radius-control)] border border-steel/30 px-3 py-2 font-data outline-none focus-visible:border-navy"
              />
            </div>
          )}

          {error && <p role="alert" className="mb-3 rounded-[var(--radius-control)] bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full rounded-[var(--radius-control)] bg-navy px-4 py-3 text-base font-semibold text-white hover:bg-[var(--color-navy-hover)] disabled:opacity-60"
          >
            {submitting ? 'সংরক্ষণ হচ্ছে…' : `বিক্রয় নিশ্চিত করুন — ${formatTaka(total)}`}
          </button>
          <p className="mt-1 text-center text-xs text-steel">নিশ্চিত করার পর এই বিক্রয় এডিট/বাতিল করা যাবে না — শুধু সংশোধনী-এন্ট্রি</p>
        </>
      )}
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { fetchActiveProductsBasic } from '../../lib/inventory';
import type { ProductBasic } from '../../lib/inventory';

// পণ্যের QR-কনটেন্ট ফরম্যাট — POS-স্ক্যানার এই একই prefix খুঁজবে (QrScanner.tsx দ্রষ্টব্য)
export function productQrPayload(productId: string): string {
  return `9EBCMS:PRODUCT:${productId}`;
}

export function ProductLabelsPage() {
  const [products, setProducts] = useState<ProductBasic[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qrDataUrls, setQrDataUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveProductsBasic()
      .then((p) => {
        setProducts(p);
        setSelected(new Set(p.map((x) => x.id)));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const QRCode = await import('qrcode');
      const map = new Map<string, string>();
      for (const p of products) {
        map.set(p.id, await QRCode.toDataURL(productQrPayload(p.id), { width: 160, margin: 1 }));
      }
      if (!cancelled) setQrDataUrls(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [products]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePrint() {
    const win = window.open('', '_blank');
    if (!win) return;
    const chosen = products.filter((p) => selected.has(p.id));
    const labels = chosen
      .map(
        (p) => `
        <div class="label">
          <img src="${qrDataUrls.get(p.id) ?? ''}" />
          <p class="name">${p.name}</p>
        </div>`
      )
      .join('');
    win.document.write(`
      <!doctype html><html lang="bn"><head><meta charset="utf-8" /><title>পণ্য QR লেবেল</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@600&display=swap');
        body { font-family: 'Hind Siliguri', sans-serif; margin: 8mm; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
        .label { border: 1px dashed #999; padding: 4mm; text-align: center; page-break-inside: avoid; }
        .label img { width: 28mm; height: 28mm; }
        .label .name { font-size: 11px; margin: 2mm 0 0; word-break: break-word; }
        @media print { .label { border: 1px solid #ccc; } }
      </style></head>
      <body><div class="grid">${labels}</div>
      <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
      </body></html>
    `);
    win.document.close();
  }

  return (
    <AppLayout>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">পণ্য QR লেবেল</h1>
        <button
          onClick={handlePrint}
          disabled={selected.size === 0}
          className="rounded-[var(--radius-control)] bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-hover disabled:opacity-50"
        >
          প্রিন্ট করুন ({selected.size})
        </button>
      </div>
      <p className="mb-5 text-sm text-steel">
        প্রতিটা পণ্যের জন্য একটা নিজস্ব QR কোড তৈরি হয় — প্রিন্ট করে পণ্যের গায়ে/তাকে লাগিয়ে দিলে POS-এ ক্যামেরা দিয়ে স্ক্যান করে সরাসরি বিক্রয়-তালিকায় যোগ করা যাবে।
      </p>

      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {products.map((p) => (
          <label
            key={p.id}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] border p-3 text-center ${selected.has(p.id) ? 'border-navy bg-navy/5' : 'border-steel/20 bg-white'}`}
          >
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="self-start" />
            {qrDataUrls.get(p.id) ? (
              <img src={qrDataUrls.get(p.id)} alt="" className="h-20 w-20" />
            ) : (
              <div className="h-20 w-20 animate-pulse bg-steel/10" />
            )}
            <p className="text-xs text-ink">{p.name}</p>
          </label>
        ))}
      </div>
    </AppLayout>
  );
}

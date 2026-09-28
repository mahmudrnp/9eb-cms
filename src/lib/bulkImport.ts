import { supabase } from './supabaseClient';
import { createSoldier, fetchCompanies, createCompany } from './soldiers';
import { createSupplier, fetchSuppliers, fetchActiveProductsBasic } from './inventory';
import { createPurchaseWithItems } from './purchases';
import type { PurchasePaymentStatus } from '../types/database.types';

// ============ ফাইল-পার্সিং (CSV/XLSX উভয়ই — SheetJS স্বয়ংক্রিয়ভাবে ফরম্যাট চেনে) ============
// লেজি-লোড — bulk-import পাতায় না গেলে xlsx লাইব্রেরি বান্ডলে যোগ হয় না (মোবাইল-ফার্স্ট)
export async function parseSpreadsheetFile(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  return rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      out[normalizeHeader(k)] = String(v ?? '').trim();
    }
    return out;
  });
}

// হেডার-নাম নমনীয়ভাবে মেলানোর জন্য — বাংলা/ইংরেজি/স্পেস/কেস যেকোনো রূপে দিলেও চলবে
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '';
}

export interface ImportRowResult {
  rowIndex: number;
  ok: boolean;
  message: string;
}

// ============ সৈনিক বাল্ক-ইমপোর্ট ============
// প্রত্যাশিত কলাম (নমনীয় হেডার-নাম): সেনা_নং/service_id, পদবি/rank, নাম/name,
// কোম্পানি/company (নাম দিয়ে ম্যাচ, না-থাকলে স্বয়ংক্রিয় তৈরি হবে), মোবাইল_নাম্বার/mobile,
// মন্তব্য/remarks — ব্যবহারকারীর নির্ধারিত ক্রম অনুযায়ী (Phase15)
export async function importSoldiersFromRows(
  rows: Record<string, string>[],
  onProgress?: (done: number, total: number) => void
): Promise<ImportRowResult[]> {
  const companies = await fetchCompanies();
  const companyMap = new Map(companies.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const results: ImportRowResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const serviceId = pick(row, 'সেনা_নং', 'সেনা_নম্বর', 'service_id', 'serviceid');
    const rank = pick(row, 'পদবি', 'rank');
    const name = pick(row, 'নাম', 'name');
    const companyName = pick(row, 'কোম্পানি', 'company');
    const mobile = pick(row, 'মোবাইল_নাম্বার', 'মোবাইল', 'mobile_number', 'mobile', 'phone');
    const remarks = pick(row, 'মন্তব্য', 'remarks', 'comment');

    if (!serviceId || !name || !rank) {
      results.push({ rowIndex: i, ok: false, message: 'সেনা নং/পদবি/নাম আবশ্যক — বাদ দেওয়া হলো' });
      onProgress?.(i + 1, rows.length);
      continue;
    }

    try {
      let companyId: string | null = null;
      if (companyName) {
        const key = companyName.trim().toLowerCase();
        companyId = companyMap.get(key) ?? null;
        if (!companyId) {
          const created = await createCompany(companyName.trim());
          companyId = created.id;
          companyMap.set(key, created.id);
        }
      }

      await createSoldier({
        service_id: serviceId,
        name,
        rank,
        company_id: companyId,
        platoon_id: null,
        mobile_number: mobile || null,
        remarks: remarks || null,
        status: 'active',
      });
      results.push({ rowIndex: i, ok: true, message: 'সংরক্ষিত' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'অজানা ত্রুটি';
      const friendly = msg.includes('duplicate') || msg.includes('unique') ? 'এই সেনা নং আগে থেকেই আছে' : msg;
      results.push({ rowIndex: i, ok: false, message: friendly });
    }
    onProgress?.(i + 1, rows.length);
  }
  return results;
}

// ============ ক্রয় বাল্ক-ইমপোর্ট ============
// প্রত্যাশিত কলাম: সরবরাহকারী/supplier, ইনভয়েস/invoice_ref, তারিখ/date (YYYY-MM-DD),
// পণ্য/product (নাম বা SKU দিয়ে ম্যাচ), পরিমাণ/quantity, একক_মূল্য/unit_cost,
// মেয়াদ/expiry_date (ঐচ্ছিক), পেমেন্ট_স্ট্যাটাস/payment_status (ঐচ্ছিক, ডিফল্ট 'due')।
// একই সরবরাহকারী+ইনভয়েস+তারিখের একাধিক সারি একটা ক্রয়-এন্ট্রিতে (একাধিক লাইন-আইটেম) গ্রুপ হয়।
interface PurchaseRowParsed {
  rowIndex: number;
  supplierName: string;
  invoiceRef: string;
  date: string;
  productName: string;
  quantity: number;
  unitCost: number;
  expiryDate: string;
  paymentStatus: string;
}

export async function importPurchasesFromRows(
  rows: Record<string, string>[],
  onProgress?: (done: number, total: number) => void
): Promise<ImportRowResult[]> {
  const [suppliers, products] = await Promise.all([fetchSuppliers(), fetchActiveProductsBasic()]);
  const supplierMap = new Map(suppliers.map((s) => [s.name.trim().toLowerCase(), s.id]));
  const productMap = new Map(products.map((p) => [p.name.trim().toLowerCase(), p.id]));

  const parsed: PurchaseRowParsed[] = rows.map((row, i) => ({
    rowIndex: i,
    supplierName: pick(row, 'সরবরাহকারী', 'supplier'),
    invoiceRef: pick(row, 'ইনভয়েস', 'ইনভয়েস_রেফারেন্স', 'invoice_ref', 'invoice'),
    date: pick(row, 'তারিখ', 'date', 'purchase_date'),
    productName: pick(row, 'পণ্য', 'product'),
    quantity: Number(pick(row, 'পরিমাণ', 'quantity')) || 0,
    unitCost: Number(pick(row, 'একক_মূল্য', 'unit_cost', 'price')) || 0,
    expiryDate: pick(row, 'মেয়াদ', 'expiry_date', 'expiry'),
    paymentStatus: pick(row, 'পেমেন্ট_স্ট্যাটাস', 'payment_status') || 'due',
  }));

  // গ্রুপিং-কী: সরবরাহকারী + ইনভয়েস + তারিখ (একই invoice-এর একাধিক লাইন এক ক্রয়ে)
  const groups = new Map<string, PurchaseRowParsed[]>();
  for (const r of parsed) {
    const key = `${r.supplierName.toLowerCase()}|${r.invoiceRef}|${r.date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const results: ImportRowResult[] = [];
  let done = 0;
  const total = rows.length;

  for (const groupRows of groups.values()) {
    const first = groupRows[0];
    if (!first.supplierName || !first.date) {
      for (const r of groupRows) results.push({ rowIndex: r.rowIndex, ok: false, message: 'সরবরাহকারী/তারিখ আবশ্যক' });
      done += groupRows.length;
      onProgress?.(done, total);
      continue;
    }

    try {
      let supplierId = supplierMap.get(first.supplierName.trim().toLowerCase());
      if (!supplierId) {
        const created = await createSupplier(first.supplierName.trim());
        supplierId = created.id;
        supplierMap.set(first.supplierName.trim().toLowerCase(), created.id);
      }

      const items: { product_id: string; quantity: number; unit_cost: number; expiry_date: string | null }[] = [];
      const lineErrors: ImportRowResult[] = [];
      for (const r of groupRows) {
        const productId = productMap.get(r.productName.trim().toLowerCase());
        if (!productId || r.quantity <= 0) {
          lineErrors.push({ rowIndex: r.rowIndex, ok: false, message: !productId ? `পণ্য "${r.productName}" খুঁজে পাওয়া যায়নি` : 'পরিমাণ সঠিক নয়' });
          continue;
        }
        items.push({ product_id: productId, quantity: r.quantity, unit_cost: r.unitCost, expiry_date: r.expiryDate || null });
      }

      if (items.length === 0) {
        results.push(...lineErrors);
        done += groupRows.length;
        onProgress?.(done, total);
        continue;
      }

      await createPurchaseWithItems({
        supplierId,
        invoiceRef: first.invoiceRef || null,
        purchaseDate: first.date,
        paymentStatus: (first.paymentStatus as PurchasePaymentStatus) || 'due',
        remarks: 'বাল্ক-আমদানি (CSV/Excel)',
        items,
      });

      for (const r of groupRows) {
        const failed = lineErrors.find((e) => e.rowIndex === r.rowIndex);
        results.push(failed ?? { rowIndex: r.rowIndex, ok: true, message: 'সংরক্ষিত' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'অজানা ত্রুটি';
      for (const r of groupRows) results.push({ rowIndex: r.rowIndex, ok: false, message: msg });
    }
    done += groupRows.length;
    onProgress?.(done, total);
  }

  return results.sort((a, b) => a.rowIndex - b.rowIndex);
}

// টেমপ্লেট-ফাইল ডাউনলোড (হেডার + একটা উদাহরণ-সারি) — যাতে ব্যবহারকারী সঠিক ফরম্যাট বুঝতে পারেন
export async function downloadTemplate(kind: 'soldiers' | 'purchases'): Promise<void> {
  const XLSX = await import('xlsx');
  const headers =
    kind === 'soldiers'
      ? ['সেনা_নং', 'পদবি', 'নাম', 'কোম্পানি', 'মোবাইল_নাম্বার', 'মন্তব্য']
      : ['সরবরাহকারী', 'ইনভয়েস', 'তারিখ', 'পণ্য', 'পরিমাণ', 'একক_মূল্য', 'মেয়াদ', 'পেমেন্ট_স্ট্যাটাস'];
  const example =
    kind === 'soldiers'
      ? ['১২৩৪৫৬৭', 'সৈনিক', 'উদাহরণ নাম', 'আলফা কোম্পানি', '01700000000', '']
      : ['উদাহরণ সরবরাহকারী', 'INV-001', new Date().toISOString().slice(0, 10), 'উদাহরণ পণ্য', '10', '25', '', 'due'];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, `${kind}-import-template.xlsx`);
  await supabase.from('audit_logs').insert({ action: 'export', table_name: `${kind}_import_template` });
}

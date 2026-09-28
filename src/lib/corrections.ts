import { supabase } from './supabaseClient';
import type { CorrectableTable, CorrectionEntryRow, CorrectionType, RecordOption } from '../types/database.types';

// প্রতিটা সংশোধনযোগ্য টেবিলের জন্য: বাংলা-লেবেল + সাম্প্রতিক-রেকর্ড সার্চ-ফাংশন।
// correction_entries নিজে কোনো টাকা/পরিমাণ স্টোর করে না (Phase02 schema) — এটা শুধু
// "কোন পুরনো রেকর্ড, কেন, কোন নতুন রেকর্ড দিয়ে সংশোধিত হলো" তার নথি। আসল সংশোধনী-লেনদেন
// (নতুন stock adjustment / নতুন payment / নতুন expense ইত্যাদি) আগে থেকেই-থাকা মডিউল
// দিয়ে তৈরি করে, তারপর এখানে এসে দুটো রেকর্ড লিংক করা হয় — এভাবেই Phase01-এর
// "কখনো এডিট/ডিলিট না, শুধু correction-entry" নীতি পালন হয়, নতুন কোনো
// হিসাব-নিয়ম উদ্ভাবন ছাড়াই।
export const TABLE_LABELS: Record<CorrectableTable, string> = {
  sales: 'বিক্রয় (Sales)',
  purchases: 'ক্রয় (Purchases)',
  stock_transactions: 'স্টক-লেনদেন (Stock Transactions)',
  payments: 'পেমেন্ট/কালেকশন (Payments)',
  expenses: 'খরচ (Expenses)',
  supplier_payments: 'সরবরাহকারী-পেমেন্ট (Supplier Payments)',
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtMoney(n: number): string {
  return `৳${n.toLocaleString('bn-BD', { maximumFractionDigits: 2 })}`;
}

async function searchSales(q: string): Promise<RecordOption[]> {
  let query = supabase
    .from('sales')
    .select('id, receipt_no, sale_date, total_amount, soldiers(name)')
    .order('sale_date', { ascending: false })
    .limit(30);
  if (q) query = query.ilike('receipt_no', `%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    label: `${r.receipt_no} — ${r.soldiers?.name ?? '—'}`,
    sublabel: `${fmtDate(r.sale_date)} · ${fmtMoney(r.total_amount)}`,
  }));
}

async function searchPurchases(q: string): Promise<RecordOption[]> {
  let query = supabase
    .from('purchases')
    .select('id, invoice_ref, purchase_date, total_cost, suppliers(name)')
    .order('purchase_date', { ascending: false })
    .limit(30);
  if (q) query = query.ilike('invoice_ref', `%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    label: `${r.invoice_ref ?? '(রেফারেন্স নেই)'} — ${r.suppliers?.name ?? '—'}`,
    sublabel: `${fmtDate(r.purchase_date)} · ${fmtMoney(r.total_cost)}`,
  }));
}

async function searchStockTransactions(q: string): Promise<RecordOption[]> {
  let query = supabase
    .from('stock_transactions')
    .select('id, txn_type, quantity, txn_date, products(name)')
    .order('txn_date', { ascending: false })
    .limit(30);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const filtered = q ? rows.filter((r) => r.products?.name?.toLowerCase().includes(q.toLowerCase())) : rows;
  return filtered.map((r) => ({
    id: r.id,
    label: `${r.products?.name ?? '—'} (${r.txn_type})`,
    sublabel: `${fmtDate(r.txn_date)} · পরিমাণ ${r.quantity}`,
  }));
}

async function searchPayments(q: string): Promise<RecordOption[]> {
  let query = supabase
    .from('payments')
    .select('id, amount, payment_date, method, soldiers(name)')
    .order('payment_date', { ascending: false })
    .limit(30);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const filtered = q ? rows.filter((r) => r.soldiers?.name?.toLowerCase().includes(q.toLowerCase())) : rows;
  return filtered.map((r) => ({
    id: r.id,
    label: `${r.soldiers?.name ?? '—'} — ${fmtMoney(r.amount)}`,
    sublabel: `${fmtDate(r.payment_date)} · ${r.method}`,
  }));
}

async function searchExpenses(q: string): Promise<RecordOption[]> {
  let query = supabase
    .from('expenses')
    .select('id, category, amount, expense_date, description')
    .order('expense_date', { ascending: false })
    .limit(30);
  if (q) query = query.ilike('category', `%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    label: `${r.category} — ${fmtMoney(r.amount)}`,
    sublabel: `${fmtDate(r.expense_date)}${r.description ? ' · ' + r.description : ''}`,
  }));
}

async function searchSupplierPayments(q: string): Promise<RecordOption[]> {
  let query = supabase
    .from('supplier_payments')
    .select('id, amount, payment_date, suppliers(name)')
    .order('payment_date', { ascending: false })
    .limit(30);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const filtered = q ? rows.filter((r) => r.suppliers?.name?.toLowerCase().includes(q.toLowerCase())) : rows;
  return filtered.map((r) => ({
    id: r.id,
    label: `${r.suppliers?.name ?? '—'} — ${fmtMoney(r.amount)}`,
    sublabel: fmtDate(r.payment_date),
  }));
}

export const TABLE_SEARCH: Record<CorrectableTable, (q: string) => Promise<RecordOption[]>> = {
  sales: searchSales,
  purchases: searchPurchases,
  stock_transactions: searchStockTransactions,
  payments: searchPayments,
  expenses: searchExpenses,
  supplier_payments: searchSupplierPayments,
};

export async function fetchCorrectionEntries(): Promise<CorrectionEntryRow[]> {
  const { data, error } = await supabase
    .from('correction_entries')
    .select(
      'id, original_table, original_record_id, reason, correction_type, new_reference_table, new_reference_id, created_by, created_at, profiles(name)'
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as CorrectionEntryRow[];
}

export async function createCorrectionEntry(params: {
  originalTable: CorrectableTable;
  originalRecordId: string;
  reason: string;
  correctionType: CorrectionType;
  newReferenceTable?: CorrectableTable | null;
  newReferenceId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('correction_entries').insert({
    original_table: params.originalTable,
    original_record_id: params.originalRecordId,
    reason: params.reason,
    correction_type: params.correctionType,
    new_reference_table: params.newReferenceTable ?? null,
    new_reference_id: params.newReferenceId ?? null,
  });
  if (error) throw error;

  // এই ম্যানুয়াল-এন্ট্রিটাও অডিট-লগে থাকা উচিত (audit_system_insert পলিসি অনুমতি দেয়)
  await supabase.from('audit_logs').insert({
    action: 'insert',
    table_name: 'correction_entries',
    after_value: { original_table: params.originalTable, correction_type: params.correctionType },
  });
}

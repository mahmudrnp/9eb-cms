import { supabase } from './supabaseClient';
import type {
  Company,
  Platoon,
  Soldier,
  SoldierWithUnit,
  SoldierLedgerRow,
  SaleRecord,
  PaymentRecord,
  LedgerTimelineEntry,
} from '../types/database.types';

export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase.from('companies').select('id, name').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlatoons(companyId?: string): Promise<Platoon[]> {
  let query = supabase.from('platoons').select('id, company_id, name').order('name');
  if (companyId) query = query.eq('company_id', companyId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createCompany(name: string): Promise<Company> {
  const { data, error } = await supabase.from('companies').insert({ name }).select('id, name').single();
  if (error) throw error;
  return data;
}

export async function createPlatoon(companyId: string, name: string): Promise<Platoon> {
  const { data, error } = await supabase
    .from('platoons')
    .insert({ company_id: companyId, name })
    .select('id, company_id, name')
    .single();
  if (error) throw error;
  return data;
}

export interface SoldierSearchParams {
  query?: string;
  companyId?: string;
  status?: string;
}

export async function searchSoldiers(params: SoldierSearchParams): Promise<SoldierWithUnit[]> {
  let query = supabase
    .from('soldiers')
    .select('*, companies(name), platoons(name)')
    .order('name');

  if (params.query) {
    // সার্ভিস-নম্বর অথবা নাম দিয়ে সার্চ — Phase01 §১১ (Search & Filter) নীতি
    query = query.or(`name.ilike.%${params.query}%,service_id.ilike.%${params.query}%`);
  }
  if (params.companyId) query = query.eq('company_id', params.companyId);
  if (params.status) query = query.eq('status', params.status);

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as SoldierWithUnit[];
}

export async function fetchSoldier(id: string): Promise<SoldierWithUnit | null> {
  const { data, error } = await supabase
    .from('soldiers')
    .select('*, companies(name), platoons(name)')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // no rows
    throw error;
  }
  return data as unknown as SoldierWithUnit;
}

export interface SoldierInput {
  service_id: string;
  name: string;
  rank: string;
  company_id: string | null;
  platoon_id: string | null;
  mobile_number: string | null;
  remarks: string | null;
  status: Soldier['status'];
}

export async function createSoldier(input: SoldierInput): Promise<Soldier> {
  const { data, error } = await supabase.from('soldiers').insert(input).select().single();
  if (error) throw error;
  return data;
}

// ⚠️ Phase01 §৬.১ নীতি: soldiers মাস্টার-ডেটা (লেনদেন না), তাই এডিট অনুমোদিত —
// কিন্তু sales/payments লেনদেন-টেবিল কখনো এডিট হয় না (আলাদা নিয়ম)।
export async function updateSoldier(id: string, input: SoldierInput): Promise<Soldier> {
  const { data, error } = await supabase
    .from('soldiers')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Phase02 `soldier_ledger` VIEW — কখনো টেবিল না, সবসময় sales+payments থেকে লাইভ-গণনা
export async function fetchSoldierLedger(soldierId: string): Promise<SoldierLedgerRow | null> {
  const { data, error } = await supabase
    .from('soldier_ledger')
    .select('*')
    .eq('soldier_id', soldierId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function fetchLedgerTimeline(soldierId: string): Promise<LedgerTimelineEntry[]> {
  const [salesRes, paymentsRes] = await Promise.all([
    supabase
      .from('sales')
      .select('id, receipt_no, sale_date, total_amount, payment_type')
      .eq('soldier_id', soldierId)
      .order('sale_date', { ascending: false })
      .limit(50) as unknown as Promise<{ data: SaleRecord[] | null; error: { message: string } | null }>,
    supabase
      .from('payments')
      .select('id, amount, method, payment_date')
      .eq('soldier_id', soldierId)
      .order('payment_date', { ascending: false })
      .limit(50) as unknown as Promise<{ data: PaymentRecord[] | null; error: { message: string } | null }>,
  ]);

  if (salesRes.error) throw salesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const saleEntries: LedgerTimelineEntry[] = (salesRes.data ?? []).map((s) => ({
    kind: 'sale',
    id: s.id,
    date: s.sale_date,
    amount: s.total_amount,
    label: `বিক্রয় ${s.receipt_no} (${paymentTypeLabel(s.payment_type)})`,
  }));

  const paymentEntries: LedgerTimelineEntry[] = (paymentsRes.data ?? []).map((p) => ({
    kind: 'payment',
    id: p.id,
    date: p.payment_date,
    amount: p.amount,
    label: `পেমেন্ট গ্রহণ (${p.method === 'cash' ? 'নগদ' : p.method})`,
  }));

  return [...saleEntries, ...paymentEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// Phase01 §৬.৩ নীতি: payment-এন্ট্রি কখনো পুরনো রেকর্ড ওভাররাইট করে না, শুধু নতুন এন্ট্রি যোগ করে
export async function recordSoldierPayment(soldierId: string, amount: number, recordedBy: string): Promise<void> {
  const { error } = await supabase.from('payments').insert({
    soldier_id: soldierId,
    amount,
    method: 'cash',
    source: 'manual',
    recorded_by: recordedBy,
  });
  if (error) throw error;
}

// Phase02 `soldier_ledger` VIEW থেকে বকেয়া-থাকা সৈনিকদের তালিকা (Cash & Credit Management মডিউল)
export async function fetchOutstandingSoldiers(): Promise<SoldierLedgerRow[]> {
  const { data, error } = await supabase.from('soldier_ledger').select('*');
  if (error) throw error;
  return (data ?? [])
    .filter((r: SoldierLedgerRow) => r.outstanding_balance > 0)
    .sort((a: SoldierLedgerRow, b: SoldierLedgerRow) => b.outstanding_balance - a.outstanding_balance);
}
function paymentTypeLabel(type: string): string {
  if (type === 'cash') return 'নগদ';
  if (type === 'credit') return 'বাকি';
  return 'আংশিক';
}

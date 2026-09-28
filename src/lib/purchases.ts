import { supabase } from './supabaseClient';
import type {
  PurchaseWithSupplier,
  Purchase,
  PurchaseItemWithProduct,
  SupplierPayableRow,
  SupplierWithPayable,
  SupplierPayment,
  PurchaseLineInput,
  PurchasePaymentStatus,
} from '../types/database.types';

// ============ Suppliers + Payable (Phase02 `supplier_payable` VIEW) ============
export async function fetchSuppliersWithPayable(): Promise<SupplierWithPayable[]> {
  const [suppliersRes, payableRes] = await Promise.all([
    supabase.from('suppliers').select('id, name, contact').order('name'),
    supabase.from('supplier_payable').select('*'),
  ]);
  if (suppliersRes.error) throw suppliersRes.error;
  if (payableRes.error) throw payableRes.error;

  const payableMap = new Map<string, SupplierPayableRow>(
    (payableRes.data ?? []).map((r: SupplierPayableRow) => [r.supplier_id, r])
  );

  return (suppliersRes.data ?? []).map((s) => ({
    ...s,
    outstanding_payable: payableMap.get(s.id)?.outstanding_payable ?? 0,
  }));
}

export async function fetchSupplierWithPayable(id: string): Promise<SupplierWithPayable | null> {
  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('id, name, contact')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  const { data: payable } = await supabase.from('supplier_payable').select('*').eq('supplier_id', id).single();
  return { ...supplier, outstanding_payable: (payable as SupplierPayableRow | null)?.outstanding_payable ?? 0 };
}

export async function recordSupplierPayment(
  supplierId: string,
  amount: number,
  recordedBy: string,
  purchaseId?: string
): Promise<SupplierPayment> {
  const { data, error } = await supabase
    .from('supplier_payments')
    .insert({ supplier_id: supplierId, amount, purchase_id: purchaseId ?? null, recorded_by: recordedBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSupplierPayments(supplierId: string): Promise<SupplierPayment[]> {
  const { data, error } = await supabase
    .from('supplier_payments')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ============ Purchases ============
export async function fetchPurchases(): Promise<PurchaseWithSupplier[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, suppliers(name)')
    .order('purchase_date', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as PurchaseWithSupplier[];
}

export async function fetchSupplierPurchases(supplierId: string): Promise<PurchaseWithSupplier[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, suppliers(name)')
    .eq('supplier_id', supplierId)
    .order('purchase_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PurchaseWithSupplier[];
}

export async function fetchPurchase(id: string): Promise<PurchaseWithSupplier | null> {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, suppliers(name)')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as unknown as PurchaseWithSupplier;
}

export async function fetchPurchaseItems(purchaseId: string): Promise<PurchaseItemWithProduct[]> {
  const { data, error } = await supabase
    .from('purchase_items')
    .select('*, products(name, unit)')
    .eq('purchase_id', purchaseId);
  if (error) throw error;
  return (data ?? []) as unknown as PurchaseItemWithProduct[];
}

export interface CreatePurchaseInput {
  supplierId: string;
  invoiceRef: string | null;
  purchaseDate: string; // YYYY-MM-DD
  paymentStatus: PurchasePaymentStatus;
  remarks: string | null;
  items: PurchaseLineInput[];
}

// Phase07 নীতি: purchase + items + stock-in একসাথে atomic — Phase02 RPC ব্যবহার করে
// (দেখুন supabase/phase07_functions.sql — এই RPC আগে থেকে রান করা থাকতে হবে)
export async function createPurchaseWithItems(input: CreatePurchaseInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_purchase_with_items', {
    p_supplier_id: input.supplierId,
    p_invoice_ref: input.invoiceRef,
    p_purchase_date: input.purchaseDate,
    p_payment_status: input.paymentStatus,
    p_remarks: input.remarks,
    p_items: input.items,
  });
  if (error) throw error;
  return data as string;
}

export type { Purchase };

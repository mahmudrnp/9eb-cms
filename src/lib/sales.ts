import { supabase } from './supabaseClient';
import type {
  ProductForPOS,
  CurrentStockRow,
  SaleLineInput,
  SaleWithSoldier,
  SaleItemWithProduct,
  PaymentType,
} from '../types/database.types';

export async function fetchProductsForPOS(query?: string): Promise<ProductForPOS[]> {
  let q = supabase
    .from('products')
    .select('id, name, unit, selling_price')
    .eq('status', 'active')
    .order('name');
  if (query) q = q.or(`name.ilike.%${query}%,sku.ilike.%${query}%`);

  const [{ data: products, error: pErr }, { data: stock, error: sErr }] = await Promise.all([
    q.limit(50),
    supabase.from('current_stock').select('*'),
  ]);
  if (pErr) throw pErr;
  if (sErr) throw sErr;

  const stockMap = new Map<string, number>((stock ?? []).map((s: CurrentStockRow) => [s.product_id, s.current_qty]));
  return (products ?? []).map((p) => ({ ...p, current_qty: stockMap.get(p.id) ?? 0 }));
}

// Phase18: QR-স্ক্যান থেকে পণ্য-আইডি সরাসরি পাওয়া গেলে একক পণ্য fetch করার জন্য
export async function fetchProductForPOSById(productId: string): Promise<ProductForPOS | null> {
  const { data: product, error } = await supabase
    .from('products')
    .select('id, name, unit, selling_price')
    .eq('id', productId)
    .eq('status', 'active')
    .single();
  if (error) return null;
  const { data: stock } = await supabase.from('current_stock').select('*').eq('product_id', productId).single();
  return { ...product, current_qty: (stock as CurrentStockRow | null)?.current_qty ?? 0 };
}

export interface CreateSaleInput {
  soldierId: string;
  items: SaleLineInput[];
  discountAmount: number;
  discountApprovedBy: string | null; // শুধু canteen_admin নিজে হলে সেট হয়
  paymentType: PaymentType;
  partialPaidAmount: number; // শুধু 'partial'-এ ব্যবহৃত
  overrideApplied: boolean;
}

// Phase08 নীতি: sale + items + stock-out atomic — RPC ব্যবহার করে (দেখুন supabase/phase08_functions.sql)
export async function createSale(input: CreateSaleInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_sale_with_items', {
    p_soldier_id: input.soldierId,
    p_items: input.items,
    p_discount_amount: input.discountAmount,
    p_discount_approved_by: input.discountApprovedBy,
    p_payment_type: input.paymentType,
    p_partial_paid_amount: input.partialPaidAmount,
    p_override_applied: input.overrideApplied,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchSale(id: string): Promise<SaleWithSoldier | null> {
  const { data, error } = await supabase
    .from('sales')
    .select('id, receipt_no, soldier_id, sale_date, subtotal, discount_amount, total_amount, payment_type, paid_amount, soldiers(name, service_id)')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as unknown as SaleWithSoldier;
}

export async function fetchSaleItems(saleId: string): Promise<SaleItemWithProduct[]> {
  const { data, error } = await supabase
    .from('sale_items')
    .select('*, products(name, unit)')
    .eq('sale_id', saleId);
  if (error) throw error;
  return (data ?? []) as unknown as SaleItemWithProduct[];
}

export async function fetchRecentSales(limit = 50): Promise<SaleWithSoldier[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('id, receipt_no, soldier_id, sale_date, subtotal, discount_amount, total_amount, payment_type, paid_amount, soldiers(name, service_id)')
    .order('sale_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as SaleWithSoldier[];
}

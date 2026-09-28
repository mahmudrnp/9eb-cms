import { supabase } from './supabaseClient';
import type {
  Category,
  Supplier,
  Product,
  ProductWithRefs,
  ProductWithStock,
  CurrentStockRow,
  StockTransaction,
  StockTxnType,
  StockBatchRow,
} from '../types/database.types';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('id, name').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(name: string): Promise<Category> {
  const { data, error } = await supabase.from('categories').insert({ name }).select('id, name').single();
  if (error) throw error;
  return data;
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select('id, name, contact').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createSupplier(name: string, contact?: string): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ name, contact: contact || null })
    .select('id, name, contact')
    .single();
  if (error) throw error;
  return data;
}

export interface ProductSearchParams {
  query?: string;
  categoryId?: string;
  lowStockOnly?: boolean;
}

// products + current_stock (VIEW) — দুটো আলাদা query করে product_id দিয়ে merge করা হয়
// (VIEW-এর সাথে PostgREST embed নির্ভরযোগ্য নয়, তাই ক্লায়েন্ট-সাইড merge)
export async function searchProducts(params: ProductSearchParams): Promise<ProductWithStock[]> {
  let query = supabase
    .from('products')
    .select('*, categories(name), suppliers(name)')
    .order('name');

  if (params.query) {
    query = query.or(`name.ilike.%${params.query}%,sku.ilike.%${params.query}%`);
  }
  if (params.categoryId) query = query.eq('category_id', params.categoryId);

  const { data: products, error: productsError } = await query.limit(200);
  if (productsError) throw productsError;

  const { data: stockRows, error: stockError } = await supabase.from('current_stock').select('*');
  if (stockError) throw stockError;

  const stockByProduct = new Map<string, CurrentStockRow>(
    (stockRows ?? []).map((r: CurrentStockRow) => [r.product_id, r])
  );

  let merged: ProductWithStock[] = ((products ?? []) as unknown as ProductWithRefs[]).map((p) => {
    const stock = stockByProduct.get(p.id);
    return {
      ...p,
      current_qty: stock?.current_qty ?? p.opening_stock,
      is_low_stock: stock?.is_low_stock ?? false,
    };
  });

  if (params.lowStockOnly) {
    merged = merged.filter((p) => p.is_low_stock);
  }

  return merged;
}

export async function fetchProduct(id: string): Promise<ProductWithStock | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(name), suppliers(name)')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  const { data: stock } = await supabase
    .from('current_stock')
    .select('*')
    .eq('product_id', id)
    .single();

  const p = data as unknown as ProductWithRefs;
  return {
    ...p,
    current_qty: (stock as CurrentStockRow | null)?.current_qty ?? p.opening_stock,
    is_low_stock: (stock as CurrentStockRow | null)?.is_low_stock ?? false,
  };
}

export interface ProductInput {
  name: string;
  sku: string | null;
  category_id: string | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  opening_stock: number;
  min_stock_level: number;
  supplier_id: string | null;
  status: Product['status'];
}

export interface ProductBasic {
  id: string;
  name: string;
  unit: string;
  purchase_price: number;
}

export async function fetchActiveProductsBasic(): Promise<ProductBasic[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, unit, purchase_price')
    .eq('status', 'active')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchStockHistory(productId: string): Promise<StockTransaction[]> {
  const { data, error } = await supabase
    .from('stock_transactions')
    .select('id, product_id, txn_type, quantity, reason, override_applied, txn_date, recorded_by')
    .eq('product_id', productId)
    .order('txn_date', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export interface StockAdjustmentInput {
  productId: string;
  txnType: StockTxnType; // Phase06-এ শুধু 'adjustment' | 'damage' | 'expired' — 'purchase_in'/'sale_out' অন্য ফেজে
  quantity: number; // সবসময় পজিটিভ সংখ্যা — এখানে সাইন নির্ধারণ হয়
  reason: string;
  overrideApplied: boolean;
  recordedBy: string; // ⚠️ হটফিক্স: DB-তে DEFAULT auth.uid() থাকলেও এখানে স্পষ্টভাবে পাঠানো নিরাপদ
}

// Phase02 নীতি: stock_transactions ইমিউটেবল, কোনো এডিট/ডিলিট না — শুধু নতুন এন্ট্রি
export async function recordStockAdjustment(input: StockAdjustmentInput): Promise<void> {
  // damage/expired সবসময় ঋণাত্মক (স্টক কমায়); adjustment ধনাত্মক বা ঋণাত্মক হতে পারে —
  // এখানে সরলীকৃত: adjustment সবসময় বাড়ানোর জন্য (ঋণাত্মক-adjustment UI Phase11+এ প্রয়োজনমতো)
  const signedQty =
    input.txnType === 'damage' || input.txnType === 'expired' ? -Math.abs(input.quantity) : Math.abs(input.quantity);

  const { error } = await supabase.from('stock_transactions').insert({
    product_id: input.productId,
    txn_type: input.txnType,
    quantity: signedQty,
    reason: input.reason,
    override_applied: input.overrideApplied,
    recorded_by: input.recordedBy,
  });
  if (error) throw error;
}

export interface StockMovementRow {
  id: string;
  product_name: string;
  unit: string;
  txn_type: StockTxnType;
  quantity: number;
  reason: string | null;
  txn_date: string;
}

export async function fetchStockMovement(startDate?: string, endDate?: string): Promise<StockMovementRow[]> {
  let q = supabase
    .from('stock_transactions')
    .select('id, txn_type, quantity, reason, txn_date, products(name, unit)')
    .order('txn_date', { ascending: false });
  if (startDate) q = q.gte('txn_date', startDate);
  if (endDate) q = q.lte('txn_date', endDate);
  const { data, error } = await q.limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const productRel = r.products as unknown as { name: string; unit: string } | { name: string; unit: string }[] | null;
    const product = Array.isArray(productRel) ? productRel[0] : productRel;
    return {
      id: r.id,
      product_name: product?.name ?? '—',
      unit: product?.unit ?? '',
      txn_type: r.txn_type,
      quantity: r.quantity,
      reason: r.reason,
      txn_date: r.txn_date,
    };
  });
}

// ============ Phase 16 — Batch-ভিত্তিক Expiry Tracking ============
// শুধু quantity_remaining > 0 এমন ব্যাচ দেখানো হয় — ইতিমধ্যে খালি ব্যাচ প্রাসঙ্গিক না।
// daysAhead দিয়ে "শীঘ্রই মেয়াদ শেষ" সীমা নির্ধারণ করা যায় (ডিফল্ট ৩০ দিন)।
export async function fetchExpiringBatches(daysAhead = 30): Promise<StockBatchRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  const { data, error } = await supabase
    .from('stock_batches')
    .select('*, products(name, unit)')
    .gt('quantity_remaining', 0)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', cutoff.toISOString().slice(0, 10))
    .order('expiry_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as StockBatchRow[];
}

export async function fetchProductBatches(productId: string): Promise<StockBatchRow[]> {
  const { data, error } = await supabase
    .from('stock_batches')
    .select('*, products(name, unit)')
    .eq('product_id', productId)
    .gt('quantity_remaining', 0)
    .order('expiry_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as StockBatchRow[];
}

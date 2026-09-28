import { supabase } from './supabaseClient';

export interface ProductPerformanceRow {
  product_id: string;
  product_name: string;
  unit: string;
  total_quantity: number;
  total_revenue: number;
}

// Phase19: sale_items থেকে সরাসরি aggregate — কোনো নতুন টেবিল/স্টোরড-সামারি না,
// Phase01-এর "সবসময় লাইভ-ট্রানজেকশন থেকে গণনা" নীতি অনুযায়ী
export async function fetchProductPerformance(startDate?: string, endDate?: string): Promise<ProductPerformanceRow[]> {
  let q = supabase
    .from('sale_items')
    .select('product_id, quantity, unit_price, products(name, unit), sales!inner(sale_date)')
    .order('product_id');
  if (startDate) q = q.gte('sales.sale_date', startDate);
  if (endDate) q = q.lte('sales.sale_date', endDate);

  const { data, error } = await q.limit(5000);
  if (error) throw error;

  const map = new Map<string, ProductPerformanceRow>();
  for (const row of (data ?? []) as unknown as {
    product_id: string;
    quantity: number;
    unit_price: number;
    products: { name: string; unit: string } | null;
  }[]) {
    const existing = map.get(row.product_id);
    const revenue = row.quantity * row.unit_price;
    if (existing) {
      existing.total_quantity += row.quantity;
      existing.total_revenue += revenue;
    } else {
      map.set(row.product_id, {
        product_id: row.product_id,
        product_name: row.products?.name ?? '—',
        unit: row.products?.unit ?? '',
        total_quantity: row.quantity,
        total_revenue: revenue,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total_quantity - a.total_quantity);
}

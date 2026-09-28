import { supabase } from './supabaseClient';
import type { DashboardSummary, CurrentStockRow, SoldierLedgerRow } from '../types/database.types';

function monthStartISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Phase01 §৮ ড্যাশবোর্ড-প্রয়োজনীয়তা — সবগুলো সংখ্যা লাইভ-কোয়েরি থেকে, কোনো ক্যাশড-সামারি-টেবিল না
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const monthStart = monthStartISO();
  const today = todayISO();

  const [
    productsRes,
    currentStockRes,
    todaySalesRes,
    monthSalesRes,
    outstandingRes,
    monthPurchasesRes,
    plRes,
    recentSalesRes,
    trendSalesRes,
  ] = await Promise.all([
    supabase.from('products').select('id, name, unit, purchase_price, min_stock_level').eq('status', 'active'),
    supabase.from('current_stock').select('*'),
    supabase.from('sales').select('total_amount').gte('sale_date', today),
    supabase.from('sales').select('total_amount, payment_type').gte('sale_date', monthStart),
    supabase.from('soldier_ledger').select('*'),
    supabase.from('purchases').select('total_cost').gte('purchase_date', monthStart),
    supabase.rpc('profit_loss', { p_start: monthStart, p_end: today }),
    supabase
      .from('sales')
      .select('id, receipt_no, total_amount, payment_type, sale_date, soldiers(name)')
      .order('sale_date', { ascending: false })
      .limit(8),
    supabase.from('sales').select('total_amount, sale_date').gte('sale_date', daysAgoISO(6)),
  ]);

  // stock_batches (Phase16) আলাদাভাবে, try/catch দিয়ে — migration এখনো রান না হলেও
  // যাতে পুরো ড্যাশবোর্ড ভেঙে না পড়ে, শুধু এই একটা সংখ্যা ০ দেখাবে
  let expiringBatchesCount = 0;
  try {
    const { count } = await supabase
      .from('stock_batches')
      .select('id', { count: 'exact', head: true })
      .gt('quantity_remaining', 0)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', daysAgoISO(-14));
    expiringBatchesCount = count ?? 0;
  } catch {
    expiringBatchesCount = 0;
  }

  const products = productsRes.data ?? [];
  const stockRows = (currentStockRes.data ?? []) as CurrentStockRow[];
  const stockByProduct = new Map(stockRows.map((r) => [r.product_id, r]));

  const totalStockValue = products.reduce((sum, p) => {
    const stock = stockByProduct.get(p.id);
    return sum + (stock?.current_qty ?? 0) * p.purchase_price;
  }, 0);

  const lowStockProducts = products
    .filter((p) => (stockByProduct.get(p.id)?.current_qty ?? 0) < p.min_stock_level)
    .map((p) => ({ id: p.id, name: p.name, unit: p.unit, current_qty: stockByProduct.get(p.id)?.current_qty ?? 0 }));

  const todaySales = (todaySalesRes.data ?? []).reduce((s, r) => s + r.total_amount, 0);

  const monthSalesRows = monthSalesRes.data ?? [];
  const monthSales = monthSalesRows.reduce((s, r) => s + r.total_amount, 0);
  const monthCashSales = monthSalesRows.filter((r) => r.payment_type === 'cash').reduce((s, r) => s + r.total_amount, 0);
  const monthCreditSales = monthSalesRows.filter((r) => r.payment_type === 'credit').reduce((s, r) => s + r.total_amount, 0);
  const monthPartialSales = monthSalesRows.filter((r) => r.payment_type === 'partial').reduce((s, r) => s + r.total_amount, 0);

  const ledgerRows = (outstandingRes.data ?? []) as SoldierLedgerRow[];
  const totalOutstanding = ledgerRows.reduce((s, r) => s + r.outstanding_balance, 0);
  const topOutstandingSoldiers = ledgerRows
    .filter((r) => r.outstanding_balance > 0)
    .sort((a, b) => b.outstanding_balance - a.outstanding_balance)
    .slice(0, 5)
    .map((r) => ({ soldier_id: r.soldier_id, name: r.name, outstanding_balance: r.outstanding_balance }));

  const monthPurchaseValue = (monthPurchasesRes.data ?? []).reduce((s, r) => s + r.total_cost, 0);

  const plRow = Array.isArray(plRes.data) ? plRes.data[0] : plRes.data;
  const monthGrossProfit = plRow?.gross_profit ?? 0;

  const recentSales = (recentSalesRes.data ?? []).map((s) => {
    const soldierRel = s.soldiers as unknown as { name: string } | { name: string }[] | null;
    const soldierName = Array.isArray(soldierRel) ? soldierRel[0]?.name : soldierRel?.name;
    return {
      id: s.id,
      receipt_no: s.receipt_no,
      soldier_name: soldierName ?? '—',
      total_amount: s.total_amount,
      payment_type: s.payment_type,
      sale_date: s.sale_date,
    };
  });

  // গত ৭ দিনের দৈনিক বিক্রয়-প্রবণতা (Dashboard চার্টের জন্য — Phase20)
  const trendMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    trendMap.set(daysAgoISO(i), 0);
  }
  for (const row of (trendSalesRes.data ?? []) as { total_amount: number; sale_date: string }[]) {
    const day = row.sale_date.slice(0, 10);
    if (trendMap.has(day)) trendMap.set(day, (trendMap.get(day) ?? 0) + row.total_amount);
  }
  const salesTrend = Array.from(trendMap.entries()).map(([date, amount]) => ({ date, amount }));

  return {
    totalStockValue,
    todaySales,
    monthSales,
    monthCashSales,
    monthCreditSales,
    monthPartialSales,
    totalOutstanding,
    monthPurchaseValue,
    monthGrossProfit,
    totalActiveProducts: products.length,
    lowStockProducts,
    topOutstandingSoldiers,
    recentSales,
    salesTrend,
    expiringBatchesCount,
  };
}

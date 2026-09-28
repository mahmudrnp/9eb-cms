// Phase 02 স্কিমা থেকে — Phase 04 (Auth+RBAC) ও Phase 05 (Soldier Management)-এর জন্য প্রয়োজনীয় অংশ।
// পূর্ণাঙ্গ generated types Phase 06+ এ `supabase gen types typescript` দিয়ে তৈরি হবে।

export type UserRole = 'canteen_admin' | 'sales_operator' | 'viewer';

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  status: 'active' | 'disabled';
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
}

export interface Platoon {
  id: string;
  company_id: string;
  name: string;
}

export type SoldierStatus = 'active' | 'transferred' | 'discharged';

// বাংলাদেশ সেনাবাহিনীর বর্তমান-প্রচলিত পদবি (উদাহরণ/সাজেশন হিসেবে — rank কলাম free-text,
// তাই তালিকার বাইরের কোনো বৈধ পদবিও লেখা যাবে)। "সিপাহী" বর্তমানে ব্যবহৃত হয় না — বাদ দেওয়া হলো।
export const COMMON_RANKS = [
  'সৈনিক',
  'ল্যান্স কর্পোরাল',
  'কর্পোরাল',
  'সার্জেন্ট',
  'স্টাফ সার্জেন্ট',
  'ওয়ারেন্ট অফিসার',
  'নায়েক সুবেদার',
  'সুবেদার',
] as const;

export interface Soldier {
  id: string;
  service_id: string;
  name: string;
  rank: string;
  company_id: string | null;
  platoon_id: string | null;
  mobile_number: string | null;
  remarks: string | null;
  status: SoldierStatus;
  created_at: string;
  updated_at: string;
}

// soldiers + companies/platoons জয়েন করা (তালিকা-পাতায় দেখানোর জন্য)
export interface SoldierWithUnit extends Soldier {
  companies: { name: string } | null;
  platoons: { name: string } | null;
}

// Phase02 `soldier_ledger` VIEW — কখনো ম্যানুয়াল-এডিটযোগ্য না, সবসময় লাইভ-গণনা
export interface SoldierLedgerRow {
  soldier_id: string;
  service_id: string;
  name: string;
  total_purchases: number;
  total_paid: number;
  outstanding_balance: number;
}

export type PaymentType = 'cash' | 'credit' | 'partial';

export interface SaleRecord {
  id: string;
  receipt_no: string;
  soldier_id: string;
  sale_date: string;
  total_amount: number;
  payment_type: PaymentType;
  paid_amount: number;
}

export interface PaymentRecord {
  id: string;
  soldier_id: string;
  sale_id: string | null;
  amount: number;
  method: string;
  source: 'manual' | 'online';
  payment_date: string;
}

// লেনদেন-টাইমলাইনে sale ও payment একসাথে মিশিয়ে দেখানোর জন্য একটা সাধারণ শেপ
export interface LedgerTimelineEntry {
  kind: 'sale' | 'payment';
  id: string;
  date: string;
  amount: number;
  label: string;
}

// ============ Phase 06 — Product & Inventory ============
export interface Category {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
}

export type ProductStatus = 'active' | 'discontinued';

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  opening_stock: number;
  min_stock_level: number;
  supplier_id: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductWithRefs extends Product {
  categories: { name: string } | null;
  suppliers: { name: string } | null;
}

// Phase02 `current_stock` VIEW — কখনো টেবিল-কলাম না, সবসময় stock_transactions থেকে লাইভ-গণনা
export interface CurrentStockRow {
  product_id: string;
  name: string;
  current_qty: number;
  min_stock_level: number;
  is_low_stock: boolean;
}

export interface ProductWithStock extends ProductWithRefs {
  current_qty: number;
  is_low_stock: boolean;
}

export type StockTxnType = 'purchase_in' | 'sale_out' | 'adjustment' | 'damage' | 'expired';

export interface StockTransaction {
  id: string;
  product_id: string;
  txn_type: StockTxnType;
  quantity: number;
  reason: string | null;
  override_applied: boolean;
  txn_date: string;
  recorded_by: string;
}

// ============ Phase 07 — Purchase & Supplier ============
export type PurchasePaymentStatus = 'paid' | 'due' | 'partial';

export interface Purchase {
  id: string;
  supplier_id: string;
  invoice_ref: string | null;
  purchase_date: string;
  payment_status: PurchasePaymentStatus;
  total_cost: number;
  remarks: string | null;
  recorded_by: string;
  created_at: string;
}

export interface PurchaseWithSupplier extends Purchase {
  suppliers: { name: string } | null;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export interface PurchaseItemWithProduct extends PurchaseItem {
  products: { name: string; unit: string } | null;
}

// Phase02 `supplier_payable` VIEW — কখনো টেবিল-কলাম না, সবসময় purchases−supplier_payments থেকে লাইভ-গণনা
export interface SupplierPayableRow {
  supplier_id: string;
  name: string;
  outstanding_payable: number;
}

export interface SupplierWithPayable {
  id: string;
  name: string;
  contact: string | null;
  outstanding_payable: number;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  purchase_id: string | null;
  amount: number;
  payment_date: string;
  recorded_by: string;
}

export interface PurchaseLineInput {
  product_id: string;
  quantity: number;
  unit_cost: number;
  expiry_date?: string | null; // YYYY-MM-DD, ঐচ্ছিক (Phase16)
}

// ============ Phase 16 — Batch-ভিত্তিক Expiry Tracking ============
export interface StockBatchRow {
  id: string;
  product_id: string;
  purchase_item_id: string | null;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  expiry_date: string | null;
  received_date: string;
  created_at: string;
  products: { name: string; unit: string } | null;
}

// ============ Phase 08 — POS & Sales ============
export interface ProductForPOS {
  id: string;
  name: string;
  unit: string;
  selling_price: number;
  current_qty: number;
}

export interface SaleLineInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface SaleWithSoldier extends SaleRecord {
  soldiers: { name: string; service_id: string } | null;
  subtotal: number;
  discount_amount: number;
}

export interface SaleItemWithProduct {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost_at_sale: number;
  line_total: number;
  products: { name: string; unit: string } | null;
}

// ============ Phase 10 — Profit/Loss & Expenses ============
export interface Expense {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string | null;
  recorded_by: string;
  created_at: string;
}

export interface ProfitLossResult {
  sales_revenue: number;
  cogs: number;
  gross_profit: number;
  expenses_total: number;
  net_result: number;
}

// ============ Phase 11 — Month-End Closing ============
export interface MonthlyClosingPreview {
  opening_stock_value: number;
  purchased_value: number;
  sold_value: number;
  adjustments_value: number;
  expected_closing_stock: number;
  sales_revenue: number;
  cogs: number;
  gross_profit: number;
  expenses_total: number;
  net_result: number;
}

export interface MonthlyClosing extends MonthlyClosingPreview {
  id: string;
  closing_month: string;
  status: 'draft' | 'finalized';
  physical_stock: number | null;
  stock_variance: number | null;
  finalized_by: string | null;
  finalized_at: string | null;
}

// ============ Phase 14 — Audit + Security + Backup ============
export type AuditAction = 'insert' | 'update' | 'delete' | 'export';

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: AuditAction | string;
  table_name: string;
  record_id: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
  profiles: { name: string } | null;
}

export type LoginEventType = 'login_success' | 'login_failed' | 'login_blocked' | 'logout';

export interface LoginEventRow {
  id: string;
  user_id: string | null;
  email_attempted: string | null;
  event_type: LoginEventType;
  user_agent: string | null;
  created_at: string;
  profiles: { name: string } | null;
}

// রিপোর্ট-এক্সপোর্ট ইভেন্ট audit_logs-এ ম্যানুয়ালি ইনসার্ট করা হয় (কোনো নতুন টেবিল না)
export type ExportFormat = 'csv' | 'excel' | 'pdf';

// ============ Phase 14b — Correction Entries (Open Issue সমাধান) ============
export type CorrectionType = 'reversal' | 'adjustment';

export const CORRECTABLE_TABLES = [
  'sales',
  'purchases',
  'stock_transactions',
  'payments',
  'expenses',
  'supplier_payments',
] as const;
export type CorrectableTable = (typeof CORRECTABLE_TABLES)[number];

export interface CorrectionEntryRow {
  id: string;
  original_table: string;
  original_record_id: string;
  reason: string;
  correction_type: CorrectionType;
  new_reference_table: string | null;
  new_reference_id: string | null;
  created_by: string;
  created_at: string;
  profiles: { name: string } | null;
}

// টেবিল-সার্চ ফলাফলের জন্য একটা কমন শেপ (lib/corrections.ts দেখুন)
export interface RecordOption {
  id: string;
  label: string;
  sublabel: string;
}

// ============ Phase 12 — Dashboard & Alerts ============
export interface DashboardSummary {
  totalStockValue: number;
  todaySales: number;
  monthSales: number;
  monthCashSales: number;
  monthCreditSales: number;
  monthPartialSales: number;
  totalOutstanding: number;
  monthPurchaseValue: number;
  monthGrossProfit: number;
  totalActiveProducts: number;
  lowStockProducts: { id: string; name: string; current_qty: number; unit: string }[];
  topOutstandingSoldiers: { soldier_id: string; name: string; outstanding_balance: number }[];
  recentSales: { id: string; receipt_no: string; soldier_name: string; total_amount: number; payment_type: PaymentType; sale_date: string }[];
  salesTrend: { date: string; amount: number }[];
  expiringBatchesCount: number;
}

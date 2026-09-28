-- ============================================================
-- Phase 02 — সম্পূর্ণ ডাটাবেস স্কিমা (৯ EB CMS)
-- Supabase SQL Editor-এ এই ফাইলটা প্রথমে রান করুন,
-- তারপর rls_policies.sql রান করুন।
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- ফাজি-সার্চ ইনডেক্সের জন্য প্রয়োজন

-- ============ ENUM TYPES ============
CREATE TYPE user_role AS ENUM ('canteen_admin', 'sales_operator', 'viewer');
CREATE TYPE payment_type AS ENUM ('cash', 'credit', 'partial');
CREATE TYPE payment_source AS ENUM ('manual', 'online');
CREATE TYPE stock_txn_type AS ENUM ('purchase_in', 'sale_out', 'adjustment', 'damage', 'expired');
CREATE TYPE purchase_payment_status AS ENUM ('paid', 'due', 'partial');
CREATE TYPE closing_status AS ENUM ('draft', 'finalized');
CREATE TYPE gateway_name AS ENUM ('bkash', 'nagad', 'sslcommerz');
CREATE TYPE gateway_txn_status AS ENUM ('initiated', 'success', 'failed', 'refunded');

-- ============ USERS / RBAC ============
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ SOLDIER ============
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE platoons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  UNIQUE(company_id, name)
);

CREATE TABLE soldiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rank TEXT NOT NULL,
  company_id UUID REFERENCES companies(id),
  platoon_id UUID REFERENCES platoons(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','transferred','discharged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_soldiers_service_id ON soldiers(service_id);
CREATE INDEX idx_soldiers_name_trgm ON soldiers USING gin (name gin_trgm_ops);

-- ============ PRODUCT & INVENTORY ============
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  category_id UUID REFERENCES categories(id),
  unit TEXT NOT NULL,
  purchase_price NUMERIC(12,2) NOT NULL CHECK (purchase_price >= 0),
  selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price >= 0),
  opening_stock NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (opening_stock >= 0),
  min_stock_level NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','discontinued')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  txn_type stock_txn_type NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  reason TEXT,
  override_applied BOOLEAN NOT NULL DEFAULT false,
  txn_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_txn_product ON stock_transactions(product_id);
CREATE INDEX idx_stock_txn_date ON stock_transactions(txn_date);
CREATE INDEX idx_stock_txn_reference ON stock_transactions(reference_type, reference_id);

-- ============ PURCHASE & SUPPLIER ============
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  invoice_ref TEXT,
  purchase_date DATE NOT NULL DEFAULT current_date,
  payment_status purchase_payment_status NOT NULL DEFAULT 'due',
  total_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  remarks TEXT,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchases_date ON purchases(purchase_date);

CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  line_total NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED
);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_product ON purchase_items(product_id);

CREATE TABLE supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  purchase_id UUID REFERENCES purchases(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT current_date,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id);

-- ============ SALES / POS ============
CREATE SEQUENCE receipt_seq;
CREATE OR REPLACE FUNCTION next_receipt_no() RETURNS TEXT AS $$
  SELECT 'CMS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('receipt_seq')::text, 5, '0');
$$ LANGUAGE sql;

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no TEXT NOT NULL UNIQUE DEFAULT next_receipt_no(),
  soldier_id UUID NOT NULL REFERENCES soldiers(id),
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  discount_approved_by UUID REFERENCES profiles(id),
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  payment_type payment_type NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= total_amount),
  stock_override BOOLEAN NOT NULL DEFAULT false,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_soldier ON sales(soldier_id);
CREATE INDEX idx_sales_date ON sales(sale_date);

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost_at_sale NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- ============ PAYMENT / CREDIT COLLECTION ============
CREATE TABLE payment_gateway_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway gateway_name NOT NULL,
  gateway_txn_id TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status gateway_txn_status NOT NULL DEFAULT 'initiated',
  soldier_id UUID REFERENCES soldiers(id),
  sale_id UUID REFERENCES sales(id),
  webhook_verified BOOLEAN NOT NULL DEFAULT false,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gateway, gateway_txn_id)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id UUID NOT NULL REFERENCES soldiers(id),
  sale_id UUID REFERENCES sales(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  source payment_source NOT NULL DEFAULT 'manual',
  gateway_txn_id UUID REFERENCES payment_gateway_transactions(id),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_soldier ON payments(soldier_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- ============ EXPENSES / MONTH-CLOSING / AUDIT / SETTINGS ============
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT current_date,
  description TEXT,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_month DATE NOT NULL UNIQUE,
  status closing_status NOT NULL DEFAULT 'draft',
  opening_stock_value NUMERIC(14,2),
  purchased_value NUMERIC(14,2),
  sold_value NUMERIC(14,2),
  adjustments_value NUMERIC(14,2),
  expected_closing_stock NUMERIC(14,2),
  physical_stock NUMERIC(14,2),
  stock_variance NUMERIC(14,2),
  cogs NUMERIC(14,2),
  sales_revenue NUMERIC(14,2),
  gross_profit NUMERIC(14,2),
  expenses_total NUMERIC(14,2),
  net_result NUMERIC(14,2),
  finalized_by UUID REFERENCES profiles(id),
  finalized_at TIMESTAMPTZ
);

CREATE TABLE correction_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_table TEXT NOT NULL,
  original_record_id UUID NOT NULL,
  reason TEXT NOT NULL,
  correction_type TEXT NOT NULL CHECK (correction_type IN ('reversal','adjustment')),
  new_reference_table TEXT,
  new_reference_id UUID,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ DERIVED VIEWS ============
CREATE VIEW current_stock AS
SELECT p.id AS product_id, p.name,
       p.opening_stock + COALESCE(SUM(st.quantity), 0) AS current_qty,
       p.min_stock_level,
       (p.opening_stock + COALESCE(SUM(st.quantity), 0)) < p.min_stock_level AS is_low_stock
FROM products p
LEFT JOIN stock_transactions st ON st.product_id = p.id
GROUP BY p.id, p.name, p.opening_stock, p.min_stock_level;

CREATE VIEW soldier_ledger AS
SELECT s.id AS soldier_id, s.service_id, s.name,
  COALESCE(sa.total_sales, 0) AS total_purchases,
  COALESCE(sa.total_paid_at_sale, 0) + COALESCE(pa.total_collected, 0) AS total_paid,
  COALESCE(sa.total_sales, 0) - COALESCE(sa.total_paid_at_sale, 0) - COALESCE(pa.total_collected, 0) AS outstanding_balance
FROM soldiers s
LEFT JOIN (SELECT soldier_id, SUM(total_amount) total_sales, SUM(paid_amount) total_paid_at_sale
           FROM sales GROUP BY soldier_id) sa ON sa.soldier_id = s.id
LEFT JOIN (SELECT soldier_id, SUM(amount) total_collected
           FROM payments GROUP BY soldier_id) pa ON pa.soldier_id = s.id;

CREATE VIEW supplier_payable AS
SELECT sup.id AS supplier_id, sup.name,
  COALESCE(pu.total_purchase, 0) - COALESCE(sp.total_paid, 0) AS outstanding_payable
FROM suppliers sup
LEFT JOIN (SELECT supplier_id, SUM(total_cost) total_purchase FROM purchases GROUP BY supplier_id) pu ON pu.supplier_id = sup.id
LEFT JOIN (SELECT supplier_id, SUM(amount) total_paid FROM supplier_payments GROUP BY supplier_id) sp ON sp.supplier_id = sup.id;

CREATE OR REPLACE FUNCTION profit_loss(p_start DATE, p_end DATE)
RETURNS TABLE(sales_revenue NUMERIC, cogs NUMERIC, gross_profit NUMERIC, expenses_total NUMERIC, net_result NUMERIC)
LANGUAGE sql STABLE AS $$
  WITH rev AS (
    SELECT COALESCE(SUM(total_amount),0) AS v FROM sales WHERE sale_date::date BETWEEN p_start AND p_end
  ), cost AS (
    SELECT COALESCE(SUM(si.quantity * si.unit_cost_at_sale),0) AS v
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.sale_date::date BETWEEN p_start AND p_end
  ), exp AS (
    SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE expense_date BETWEEN p_start AND p_end
  )
  SELECT rev.v, cost.v, rev.v - cost.v, exp.v, (rev.v - cost.v) - exp.v
  FROM rev, cost, exp;
$$;

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION prevent_negative_stock() RETURNS TRIGGER AS $$
DECLARE v_current NUMERIC;
BEGIN
  SELECT current_qty INTO v_current FROM current_stock WHERE product_id = NEW.product_id;
  IF (COALESCE(v_current,0) + NEW.quantity) < 0 AND NOT NEW.override_applied THEN
    RAISE EXCEPTION 'ঋণাত্মক স্টক অনুমোদিত নয় (product_id: %, চেষ্টা: %) — override প্রয়োজন', NEW.product_id, NEW.quantity;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_negative_stock
BEFORE INSERT ON stock_transactions
FOR EACH ROW EXECUTE FUNCTION prevent_negative_stock();

CREATE OR REPLACE FUNCTION log_audit() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs(user_id, action, table_name, record_id, before_value, after_value)
  VALUES (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_sales AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER trg_audit_purchases AFTER INSERT OR UPDATE OR DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER trg_audit_stock_transactions AFTER INSERT OR UPDATE OR DELETE ON stock_transactions
  FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER trg_audit_monthly_closings AFTER INSERT OR UPDATE OR DELETE ON monthly_closings
  FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER trg_audit_supplier_payments AFTER INSERT OR UPDATE OR DELETE ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER trg_audit_correction_entries AFTER INSERT OR UPDATE OR DELETE ON correction_entries
  FOR EACH ROW EXECUTE FUNCTION log_audit();

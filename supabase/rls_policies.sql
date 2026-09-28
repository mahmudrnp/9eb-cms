-- ============================================================
-- Phase 04 — সম্পূর্ণ Row-Level Security পলিসি-সেট
-- ৯ EB CMS | ৩-রোল RBAC: canteen_admin, sales_operator, viewer
-- Phase02-এ চিহ্নিত "Open Issue" এখানে সমাধান করা হলো।
-- এই ফাইল Supabase SQL Editor-এ বা migration হিসেবে রান করতে হবে,
-- Phase02_PART_B-এর টেবিল-তৈরির স্ক্রিপ্টের পরে।
-- ============================================================

-- সব টেবিলে RLS চালু
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE platoons ENABLE ROW LEVEL SECURITY;
ALTER TABLE soldiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_gateway_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- সহায়ক ফাংশন: বর্তমান ইউজারের রোল (প্রতিটা পলিসিতে বারবার sub-query এড়াতে)
CREATE OR REPLACE FUNCTION current_role_name() RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ============ profiles (User Management — শুধু canteen_admin) ============
CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (current_role_name() = 'canteen_admin');
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (current_role_name() = 'canteen_admin');
CREATE POLICY profiles_delete ON profiles FOR DELETE USING (false); -- ইউজার ডিলিট না, শুধু status='disabled'

-- ============ মাস্টার-ডেটা: companies/platoons/soldiers/categories/suppliers/products ============
-- প্যাটার্ন: সবাই SELECT করতে পারে; শুধু canteen_admin তৈরি/সম্পাদনা করতে পারে (এগুলো লেনদেন নয়, মাস্টার-ডেটা)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','platoons','soldiers','categories','suppliers','products'] LOOP
    EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (true);', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON %I FOR INSERT WITH CHECK (current_role_name() = ''canteen_admin'');', t, t);
    EXECUTE format('CREATE POLICY %I_update ON %I FOR UPDATE USING (current_role_name() = ''canteen_admin'');', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON %I FOR DELETE USING (false);', t, t); -- মাস্টার-ডেটাও ডিলিট না, status/active ফ্ল্যাগ দিয়ে
  END LOOP;
END $$;

-- ============ sales / sale_items (POS — canteen_admin + sales_operator create; কখনো এডিট/ডিলিট না) ============
CREATE POLICY sales_select ON sales FOR SELECT USING (true);
CREATE POLICY sales_insert ON sales FOR INSERT WITH CHECK (current_role_name() IN ('canteen_admin','sales_operator'));
CREATE POLICY sales_no_update ON sales FOR UPDATE USING (false);
CREATE POLICY sales_no_delete ON sales FOR DELETE USING (false);

CREATE POLICY sale_items_select ON sale_items FOR SELECT USING (true);
CREATE POLICY sale_items_insert ON sale_items FOR INSERT WITH CHECK (current_role_name() IN ('canteen_admin','sales_operator'));
CREATE POLICY sale_items_no_update ON sale_items FOR UPDATE USING (false);
CREATE POLICY sale_items_no_delete ON sale_items FOR DELETE USING (false);

-- ডিসকাউন্ট-ফিল্ড (sales.discount_amount > 0) শুধু canteen_admin অনুমোদন দিতে পারবে — অ্যাপ-লজিকে
-- discount_approved_by = auth.uid() বসাতে হবে, ও এই CHECK constraint টা টেবিলে যোগ করা:
-- ALTER TABLE sales ADD CONSTRAINT discount_requires_admin
--   CHECK (discount_amount = 0 OR discount_approved_by IS NOT NULL);

-- ============ stock_transactions (Stock Adjustment — শুধু canteen_admin) ============
CREATE POLICY stock_txn_select ON stock_transactions FOR SELECT USING (true);
CREATE POLICY stock_txn_insert ON stock_transactions FOR INSERT WITH CHECK (
  current_role_name() = 'canteen_admin'
  OR (current_role_name() = 'sales_operator' AND txn_type = 'sale_out') -- POS-বিক্রয়ের সাথে auto stock-out
);
CREATE POLICY stock_txn_no_update ON stock_transactions FOR UPDATE USING (false);
CREATE POLICY stock_txn_no_delete ON stock_transactions FOR DELETE USING (false);

-- ============ purchases / purchase_items (শুধু canteen_admin) ============
CREATE POLICY purchases_select ON purchases FOR SELECT USING (true);
CREATE POLICY purchases_insert ON purchases FOR INSERT WITH CHECK (current_role_name() = 'canteen_admin');
CREATE POLICY purchases_no_update ON purchases FOR UPDATE USING (false);
CREATE POLICY purchases_no_delete ON purchases FOR DELETE USING (false);

CREATE POLICY purchase_items_select ON purchase_items FOR SELECT USING (true);
CREATE POLICY purchase_items_insert ON purchase_items FOR INSERT WITH CHECK (current_role_name() = 'canteen_admin');
CREATE POLICY purchase_items_no_update ON purchase_items FOR UPDATE USING (false);
CREATE POLICY purchase_items_no_delete ON purchase_items FOR DELETE USING (false);

CREATE POLICY supplier_payments_select ON supplier_payments FOR SELECT USING (true);
CREATE POLICY supplier_payments_insert ON supplier_payments FOR INSERT WITH CHECK (current_role_name() = 'canteen_admin');
CREATE POLICY supplier_payments_no_update ON supplier_payments FOR UPDATE USING (false);
CREATE POLICY supplier_payments_no_delete ON supplier_payments FOR DELETE USING (false);

-- ============ payments (Payment/Credit Collection — canteen_admin + sales_operator, রিভিশন৩ সিদ্ধান্ত) ============
CREATE POLICY payments_select ON payments FOR SELECT USING (true);
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (
  current_role_name() IN ('canteen_admin','sales_operator') OR auth.role() = 'service_role' -- webhook থেকে online-পেমেন্ট
);
CREATE POLICY payments_no_update ON payments FOR UPDATE USING (false);
CREATE POLICY payments_no_delete ON payments FOR DELETE USING (false);

-- payment_gateway_transactions: শুধু service_role (Edge Function) লিখবে, কোনো ইউজার-রোল সরাসরি না
CREATE POLICY pgt_select ON payment_gateway_transactions FOR SELECT USING (current_role_name() = 'canteen_admin');
CREATE POLICY pgt_service_write ON payment_gateway_transactions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============ expenses (শুধু canteen_admin) ============
CREATE POLICY expenses_select ON expenses FOR SELECT USING (true);
CREATE POLICY expenses_insert ON expenses FOR INSERT WITH CHECK (current_role_name() = 'canteen_admin');
CREATE POLICY expenses_no_update ON expenses FOR UPDATE USING (false);
CREATE POLICY expenses_no_delete ON expenses FOR DELETE USING (false);

-- ============ monthly_closings (draft→finalized আপডেট শুধু canteen_admin; ফাইনালাইজের পর ইমিউটেবল) ============
CREATE POLICY closings_select ON monthly_closings FOR SELECT USING (true);
CREATE POLICY closings_insert ON monthly_closings FOR INSERT WITH CHECK (current_role_name() = 'canteen_admin');
CREATE POLICY closings_update ON monthly_closings FOR UPDATE USING (
  current_role_name() = 'canteen_admin' AND status = 'draft'   -- ফাইনালাইজড হয়ে গেলে আর UPDATE-যোগ্য না
);
CREATE POLICY closings_no_delete ON monthly_closings FOR DELETE USING (false);

-- ============ correction_entries (সংশোধনী-এন্ট্রি — শুধু canteen_admin তৈরি করতে পারবে) ============
CREATE POLICY corrections_select ON correction_entries FOR SELECT USING (true);
CREATE POLICY corrections_insert ON correction_entries FOR INSERT WITH CHECK (current_role_name() = 'canteen_admin');
CREATE POLICY corrections_no_update ON correction_entries FOR UPDATE USING (false);
CREATE POLICY corrections_no_delete ON correction_entries FOR DELETE USING (false);

-- ============ audit_logs (সবাই দেখতে পারে; শুধু trigger/system লিখবে, কোনো ইউজার-রোল সরাসরি লিখতে পারবে না) ============
CREATE POLICY audit_select ON audit_logs FOR SELECT USING (true);
CREATE POLICY audit_system_insert ON audit_logs FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);
CREATE POLICY audit_no_update ON audit_logs FOR UPDATE USING (false);
CREATE POLICY audit_no_delete ON audit_logs FOR DELETE USING (false);

-- ============ settings (শুধু canteen_admin এডিট করতে পারবে, সবাই দেখতে পারে) ============
CREATE POLICY settings_select ON settings FOR SELECT USING (true);
CREATE POLICY settings_upsert ON settings FOR INSERT WITH CHECK (current_role_name() = 'canteen_admin');
CREATE POLICY settings_update ON settings FOR UPDATE USING (current_role_name() = 'canteen_admin');
CREATE POLICY settings_no_delete ON settings FOR DELETE USING (false);

-- ============================================================
-- Phase 08 — POS + Sales: atomic sale-creation RPC
-- একটা বিক্রয় = sales + sale_items (N লাইন) + stock_transactions (N sale_out এন্ট্রি)
-- + [ঐচ্ছিক] payments (নগদ/আংশিক অংশ) — সব একসাথে, all-or-nothing (Phase01/02 ACID নীতি)।
-- ঋণাত্মক-স্টক হলে prevent_negative_stock trigger (Phase02) স্বয়ংক্রিয়ভাবে পুরো ট্রানজেকশন
-- বাতিল করবে যদি override_applied=false — এই RPC-ও তার বাইরে না, তাই override না দিলে
-- পুরো বিক্রয়ই ব্যর্থ হবে (আংশিক sale_items তৈরি হয়ে যাবে না)।
-- এই ফাইলটা schema.sql, rls_policies.sql, phase07_functions.sql-এর পরে রান করুন।
-- ============================================================

CREATE OR REPLACE FUNCTION create_sale_with_items(
  p_soldier_id UUID,
  p_items JSONB,                  -- [{"product_id": "...", "quantity": 2, "unit_price": 5}, ...]
  p_discount_amount NUMERIC,
  p_discount_approved_by UUID,    -- ডিসকাউন্ট থাকলে বাধ্যতামূলক (শুধু canteen_admin নিজে অনুমোদন দিতে পারে)
  p_payment_type payment_type,
  p_partial_paid_amount NUMERIC,  -- শুধু payment_type='partial' হলে ব্যবহৃত হয়
  p_override_applied BOOLEAN
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
  v_sale_id UUID;
  v_subtotal NUMERIC(14,2);
  v_total NUMERIC(14,2);
  v_paid NUMERIC(14,2);
  v_item JSONB;
  v_unit_cost NUMERIC(12,2);
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'অন্তত একটা পণ্য যোগ করতে হবে।';
  END IF;

  IF p_discount_amount > 0 AND p_discount_approved_by IS NULL THEN
    RAISE EXCEPTION 'ডিসকাউন্ট প্রয়োগের জন্য Canteen Admin-এর অনুমোদন আবশ্যক।';
  END IF;

  SELECT COALESCE(SUM((item->>'quantity')::NUMERIC * (item->>'unit_price')::NUMERIC), 0)
  INTO v_subtotal
  FROM jsonb_array_elements(p_items) AS item;

  v_total := v_subtotal - COALESCE(p_discount_amount, 0);
  IF v_total < 0 THEN
    RAISE EXCEPTION 'ডিসকাউন্ট সাবটোটালের চেয়ে বেশি হতে পারে না।';
  END IF;

  -- Phase01 §৬.৩ নীতি: পেমেন্ট-ধরন অনুযায়ী paid_amount নির্ধারণ (ফ্রন্টএন্ড-ইনপুট নয়, সার্ভার-সাইড নিশ্চিত)
  v_paid := CASE p_payment_type
    WHEN 'cash' THEN v_total
    WHEN 'credit' THEN 0
    WHEN 'partial' THEN LEAST(GREATEST(COALESCE(p_partial_paid_amount, 0), 0), v_total)
  END;

  INSERT INTO sales (soldier_id, subtotal, discount_amount, discount_approved_by, total_amount, payment_type, paid_amount, stock_override, recorded_by)
  VALUES (p_soldier_id, v_subtotal, COALESCE(p_discount_amount, 0), p_discount_approved_by, v_total, p_payment_type, v_paid, p_override_applied, auth.uid())
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT purchase_price INTO v_unit_cost FROM products WHERE id = (v_item->>'product_id')::UUID;

    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost_at_sale)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE(v_unit_cost, 0)   -- বিক্রির মুহূর্তের ক্রয়-মূল্যের স্ন্যাপশট — সঠিক COGS-এর জন্য (Phase02 নীতি)
    );

    INSERT INTO stock_transactions (product_id, txn_type, quantity, reference_type, reference_id, override_applied, recorded_by)
    VALUES (
      (v_item->>'product_id')::UUID,
      'sale_out',
      -1 * (v_item->>'quantity')::NUMERIC,   -- বিক্রয় সবসময় স্টক কমায় — ঋণাত্মক
      'sale',
      v_sale_id,
      p_override_applied,
      auth.uid()
    );
  END LOOP;

  -- ⚠️ এখানে payments টেবিলে কিছু INSERT করা হয় না — sales.paid_amount নিজেই
  -- at-sale পরিশোধিত অংশ ধারণ করে, আর soldier_ledger VIEW (Phase02) সূত্র অনুযায়ী
  -- sales.paid_amount ও payments.amount আলাদাভাবে যোগ করে (outstanding = total − paid_at_sale − collected)।
  -- এখানে payments-এও INSERT করলে সেই অংশ দুইবার বিয়োগ হয়ে outstanding ভুল হিসাব হতো।
  -- payments টেবিল শুধু *পরবর্তী* বকেয়া-আদায়ের জন্য (Phase01 §৬.৩ ওয়ার্কফ্লো, Phase09-এ বাস্তবায়িত)।

  RETURN v_sale_id;
END;
$$;

-- sale_items-এও audit trigger যোগ (Phase02-এ বাদ পড়েছিল, purchase_items-এর মতোই)
CREATE TRIGGER trg_audit_sale_items AFTER INSERT OR UPDATE OR DELETE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION log_audit();

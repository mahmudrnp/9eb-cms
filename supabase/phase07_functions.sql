-- ============================================================
-- Phase 07 — Purchase + Supplier: atomic purchase-creation RPC
-- একটা ক্রয়-এন্ট্রি = purchases + purchase_items (N লাইন) + stock_transactions (N লাইন)
-- একসাথে সব-বা-কিছুই-না (all-or-nothing) হওয়া বাধ্যতামূলক — Phase01/02-এর ACID নীতি
-- (আলাদা আলাদা INSERT কল দিয়ে করলে মাঝপথে ব্যর্থ হলে ডেটা-অসংগতি হতে পারে)।
-- এই ফাংশনটা SECURITY INVOKER (ডিফল্ট) — অর্থাৎ কলকারী ইউজারের RLS-ই প্রযোজ্য হয়,
-- তাই শুধু canteen_admin-ই সফলভাবে কল করতে পারবে (purchases/purchase_items/stock_transactions-এর
-- বিদ্যমান RLS পলিসি অনুযায়ী) — কোনো অতিরিক্ত পারমিশন বাইপাস হয় না।
-- এই ফাইলটা schema.sql ও rls_policies.sql-এর পরে Supabase SQL Editor-এ রান করুন।
-- ============================================================

CREATE OR REPLACE FUNCTION create_purchase_with_items(
  p_supplier_id UUID,
  p_invoice_ref TEXT,
  p_purchase_date DATE,
  p_payment_status purchase_payment_status,
  p_remarks TEXT,
  p_items JSONB   -- [{"product_id": "...", "quantity": 10, "unit_cost": 5.50}, ...]
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
  v_purchase_id UUID;
  v_total_cost NUMERIC(14,2);
  v_item JSONB;
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'অন্তত একটা পণ্য-লাইন যোগ করতে হবে।';
  END IF;

  SELECT COALESCE(SUM((item->>'quantity')::NUMERIC * (item->>'unit_cost')::NUMERIC), 0)
  INTO v_total_cost
  FROM jsonb_array_elements(p_items) AS item;

  INSERT INTO purchases (supplier_id, invoice_ref, purchase_date, payment_status, total_cost, remarks, recorded_by)
  VALUES (p_supplier_id, p_invoice_ref, p_purchase_date, p_payment_status, v_total_cost, p_remarks, auth.uid())
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost)
    VALUES (
      v_purchase_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_cost')::NUMERIC
    );

    INSERT INTO stock_transactions (product_id, txn_type, quantity, reference_type, reference_id, recorded_by)
    VALUES (
      (v_item->>'product_id')::UUID,
      'purchase_in',
      (v_item->>'quantity')::NUMERIC,   -- সবসময় পজিটিভ — ক্রয় সবসময় স্টক বাড়ায়
      'purchase',
      v_purchase_id,
      auth.uid()
    );
  END LOOP;

  RETURN v_purchase_id;
END;
$$;

-- purchases-এ audit trigger আগে থেকেই আছে (Phase02); purchase_items ও stock_transactions-এর
-- আলাদা audit-trigger নেই (Phase02-এ শুধু নির্বাচিত টেবিলে বসানো হয়েছিল) — এখানে ঐচ্ছিক সংযোজন:
CREATE TRIGGER trg_audit_purchase_items AFTER INSERT OR UPDATE OR DELETE ON purchase_items
  FOR EACH ROW EXECUTE FUNCTION log_audit();

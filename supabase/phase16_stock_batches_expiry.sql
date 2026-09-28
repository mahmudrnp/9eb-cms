-- ============================================================
-- Phase 16 — Batch-ভিত্তিক মেয়াদ-উত্তীর্ণ (Expiry) ট্র্যাকিং
-- ৯ EB CMS
-- phase15_soldier_fields.sql-এর পরে রান করুন।
-- ============================================================

-- ডিজাইন-নীতি (স্পষ্টভাবে বলা প্রয়োজন): এই পুরো migration টা current_stock/COGS/
-- P&L-এর বিদ্যমান, টেস্ট-করা গণনা-লজিক একটুও বদলায় না। stock_batches একটা সম্পূর্ণ
-- সংযোজিত (additive), পার্শ্ব-স্তর — শুধু "কোন ব্যাচের মেয়াদ কবে শেষ" ট্র্যাক ও অ্যালার্ট
-- করার জন্য। current_stock VIEW আগের মতোই stock_transactions-এর সমষ্টি থেকে গণনা হয়,
-- COGS আগের মতোই sale_items.unit_cost_at_sale থেকে — এসবের কোনোটাই batch-নির্ভর না।

-- ============ purchase_items-এ expiry_date যোগ (ঐচ্ছিক — সব পণ্য পচনশীল না) ============
ALTER TABLE purchase_items ADD COLUMN expiry_date DATE;

-- ============ stock_batches — প্রতিটা ক্রয়-লাইন থেকে একটা ব্যাচ ============
CREATE TABLE stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  purchase_item_id UUID UNIQUE REFERENCES purchase_items(id),
  quantity_received NUMERIC(12,2) NOT NULL,
  quantity_remaining NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  expiry_date DATE,
  received_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_batches_product ON stock_batches(product_id);
CREATE INDEX idx_stock_batches_expiry ON stock_batches(expiry_date) WHERE quantity_remaining > 0;

ALTER TABLE stock_batches ENABLE ROW LEVEL SECURITY;
-- সবাই দেখতে পারে (stock_transactions-এর মতোই — Inventory/Dashboard-এ এক্সপায়ারি-অ্যালার্ট দেখানোর জন্য)
CREATE POLICY stock_batches_select ON stock_batches FOR SELECT USING (true);
-- শুধু ট্রিগার-চালিত লেখা (নিচে) — সরাসরি ইউজার-ইনসার্ট/আপডেট না হলেও ভালো, কিন্তু trigger
-- ফাংশনগুলো SECURITY DEFINER না (Phase02-এর log_audit()-এর মতোই ধারাবাহিকতা রক্ষায়), তাই
-- ট্রিগার-প্রসঙ্গে কলকারী-ইউজারের নিজস্ব INSERT/UPDATE-অনুমতি লাগবে — সেজন্য যেকোনো authenticated
-- ইউজারকে এই সীমিত-উদ্দেশ্যে অনুমতি দেওয়া হলো (audit_logs-এর audit_system_insert পলিসির মতোই ধরন)।
CREATE POLICY stock_batches_insert ON stock_batches FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY stock_batches_update ON stock_batches FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY stock_batches_no_delete ON stock_batches FOR DELETE USING (false);

-- ============ ট্রিগার ১: ক্রয়-লাইন তৈরি হলে একটা ব্যাচ তৈরি হয় ============
CREATE OR REPLACE FUNCTION create_stock_batch() RETURNS TRIGGER AS $$
DECLARE
  v_purchase_date DATE;
BEGIN
  SELECT purchase_date INTO v_purchase_date FROM purchases WHERE id = NEW.purchase_id;

  INSERT INTO stock_batches (product_id, purchase_item_id, quantity_received, quantity_remaining, unit_cost, expiry_date, received_date)
  VALUES (NEW.product_id, NEW.id, NEW.quantity, NEW.quantity, NEW.unit_cost, NEW.expiry_date, COALESCE(v_purchase_date, CURRENT_DATE));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_stock_batch AFTER INSERT ON purchase_items
  FOR EACH ROW EXECUTE FUNCTION create_stock_batch();

-- ============ ট্রিগার ২: স্টক কমলে (বিক্রয়/ক্ষতিগ্রস্ত/মেয়াদোত্তীর্ণ/ঋণাত্মক-সমন্বয়)
-- সবচেয়ে কাছের-মেয়াদের ব্যাচ থেকে আগে বিয়োগ (FIFO-by-expiry, তারপর প্রাপ্তি-তারিখ) ============
-- ⚠️ এটা best-effort/non-blocking: ব্যাচ-রেকর্ড অপর্যাপ্ত/অনুপস্থিত হলেও (যেমন opening_stock-এর
-- কোনো ব্যাচ নেই, বা migration-এর আগের পুরনো স্টক) কখনো এরর/ব্যতিক্রম ছোঁড়ে না — কারণ এই লেয়ারটা
-- শুধু এক্সপায়ারি-দৃশ্যমানতার জন্য, মূল বিক্রয়/সমন্বয়-ফ্লো কখনো এর ওপর নির্ভরশীল না।
CREATE OR REPLACE FUNCTION consume_from_batches() RETURNS TRIGGER AS $$
DECLARE
  v_remaining_to_consume NUMERIC(12,2);
  v_batch RECORD;
  v_take NUMERIC(12,2);
BEGIN
  IF NEW.quantity >= 0 THEN
    RETURN NEW; -- শুধু স্টক-হ্রাসকারী এন্ট্রিতে প্রযোজ্য
  END IF;

  v_remaining_to_consume := ABS(NEW.quantity);

  FOR v_batch IN
    SELECT id, quantity_remaining FROM stock_batches
    WHERE product_id = NEW.product_id AND quantity_remaining > 0
    ORDER BY expiry_date ASC NULLS LAST, received_date ASC
  LOOP
    EXIT WHEN v_remaining_to_consume <= 0;
    v_take := LEAST(v_batch.quantity_remaining, v_remaining_to_consume);
    UPDATE stock_batches SET quantity_remaining = quantity_remaining - v_take WHERE id = v_batch.id;
    v_remaining_to_consume := v_remaining_to_consume - v_take;
  END LOOP;

  -- v_remaining_to_consume > 0 থেকে গেলেও (ব্যাচ অপর্যাপ্ত) চুপচাপ উপেক্ষা — উপরের মন্তব্য দেখুন
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consume_from_batches AFTER INSERT ON stock_transactions
  FOR EACH ROW EXECUTE FUNCTION consume_from_batches();

-- ============ create_purchase_with_items() আপডেট — প্রতিটা লাইনে ঐচ্ছিক expiry_date ============
-- স্বাক্ষর (signature) অপরিবর্তিত (p_items JSONB), শুধু প্রতিটা আইটেমে "expiry_date" কী (key)
-- ঐচ্ছিকভাবে পড়া হয় — পুরনো কল (expiry_date ছাড়া) আগের মতোই কাজ করবে (NULL হবে)।
CREATE OR REPLACE FUNCTION create_purchase_with_items(
  p_supplier_id UUID,
  p_invoice_ref TEXT,
  p_purchase_date DATE,
  p_payment_status purchase_payment_status,
  p_remarks TEXT,
  p_items JSONB   -- [{"product_id": "...", "quantity": 10, "unit_cost": 5.50, "expiry_date": "2026-12-31"}, ...]
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
    INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, expiry_date)
    VALUES (
      v_purchase_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_cost')::NUMERIC,
      NULLIF(v_item->>'expiry_date', '')::DATE
    );

    INSERT INTO stock_transactions (product_id, txn_type, quantity, reference_type, reference_id, recorded_by)
    VALUES (
      (v_item->>'product_id')::UUID,
      'purchase_in',
      (v_item->>'quantity')::NUMERIC,
      'purchase',
      v_purchase_id,
      auth.uid()
    );
  END LOOP;

  RETURN v_purchase_id;
END;
$$;

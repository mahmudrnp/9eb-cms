-- ============================================================
-- Phase 11 — Month-End Closing: স্টক-মূল্যায়ন + ফাইনালাইজ RPC
-- Phase01 §৬.৬ ওয়ার্কফ্লো: Opening + Purchased − Sold ± Adjustments = Expected Closing
-- → Physical Count → Variance → Finalize (এরপর সেই মাসের কোনো লেনদেন এডিট/ডিলিট-যোগ্য নয়)
-- এই ফাইলটা schema.sql, rls_policies.sql, phase07/08_functions.sql-এর পরে রান করুন।
-- ============================================================

-- একটা নির্দিষ্ট তারিখ পর্যন্ত মোট স্টক-মূল্য (Taka) — বর্তমান ক্রয়-মূল্যে মূল্যায়িত
CREATE OR REPLACE FUNCTION stock_value_as_of(p_date DATE)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(
    (p.opening_stock + COALESCE(st.qty_sum, 0)) * p.purchase_price
  ), 0)
  FROM products p
  LEFT JOIN (
    SELECT product_id, SUM(quantity) AS qty_sum
    FROM stock_transactions
    WHERE txn_date::date <= p_date
    GROUP BY product_id
  ) st ON st.product_id = p.id;
$$;

-- একটা সময়-সীমার জন্য মাস-ক্লোজিং প্রিভিউ (কোনো কিছু সংরক্ষণ করে না, শুধু গণনা)
CREATE OR REPLACE FUNCTION monthly_closing_preview(p_start DATE, p_end DATE)
RETURNS TABLE(
  opening_stock_value NUMERIC, purchased_value NUMERIC, sold_value NUMERIC,
  adjustments_value NUMERIC, expected_closing_stock NUMERIC,
  sales_revenue NUMERIC, cogs NUMERIC, gross_profit NUMERIC, expenses_total NUMERIC, net_result NUMERIC
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_opening NUMERIC;
  v_purchased NUMERIC;
  v_sold NUMERIC;
  v_adjustments NUMERIC;
  v_pl RECORD;
BEGIN
  v_opening := stock_value_as_of((p_start - INTERVAL '1 day')::date);

  SELECT COALESCE(SUM(pi.quantity * pi.unit_cost), 0) INTO v_purchased
  FROM purchase_items pi JOIN purchases pu ON pu.id = pi.purchase_id
  WHERE pu.purchase_date BETWEEN p_start AND p_end;

  SELECT COALESCE(SUM(si.quantity * si.unit_cost_at_sale), 0) INTO v_sold
  FROM sale_items si JOIN sales s ON s.id = si.sale_id
  WHERE s.sale_date::date BETWEEN p_start AND p_end;

  SELECT COALESCE(SUM(st.quantity * p.purchase_price), 0) INTO v_adjustments
  FROM stock_transactions st JOIN products p ON p.id = st.product_id
  WHERE st.txn_type IN ('adjustment', 'damage', 'expired')
    AND st.txn_date::date BETWEEN p_start AND p_end;

  SELECT * INTO v_pl FROM profit_loss(p_start, p_end);

  RETURN QUERY SELECT
    v_opening, v_purchased, v_sold, v_adjustments,
    v_opening + v_purchased - v_sold + v_adjustments,
    v_pl.sales_revenue, v_pl.cogs, v_pl.gross_profit, v_pl.expenses_total, v_pl.net_result;
END;
$$;

-- চূড়ান্ত ফাইনালাইজেশন — শুধু canteen_admin (RLS দিয়ে বলবৎ), একবার ফাইনাল হলে আর ফাইনাল করা যাবে না
CREATE OR REPLACE FUNCTION finalize_month_closing(
  p_closing_month DATE, p_start DATE, p_end DATE, p_physical_stock NUMERIC
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
  v_preview RECORD;
BEGIN
  SELECT * INTO v_preview FROM monthly_closing_preview(p_start, p_end);

  INSERT INTO monthly_closings (
    closing_month, status, opening_stock_value, purchased_value, sold_value,
    adjustments_value, expected_closing_stock, physical_stock, stock_variance,
    cogs, sales_revenue, gross_profit, expenses_total, net_result,
    finalized_by, finalized_at
  ) VALUES (
    p_closing_month, 'finalized', v_preview.opening_stock_value, v_preview.purchased_value, v_preview.sold_value,
    v_preview.adjustments_value, v_preview.expected_closing_stock, p_physical_stock,
    p_physical_stock - v_preview.expected_closing_stock,
    v_preview.cogs, v_preview.sales_revenue, v_preview.gross_profit, v_preview.expenses_total, v_preview.net_result,
    auth.uid(), now()
  )
  ON CONFLICT (closing_month) DO UPDATE SET
    status = 'finalized',
    opening_stock_value = EXCLUDED.opening_stock_value,
    purchased_value = EXCLUDED.purchased_value,
    sold_value = EXCLUDED.sold_value,
    adjustments_value = EXCLUDED.adjustments_value,
    expected_closing_stock = EXCLUDED.expected_closing_stock,
    physical_stock = EXCLUDED.physical_stock,
    stock_variance = EXCLUDED.stock_variance,
    cogs = EXCLUDED.cogs,
    sales_revenue = EXCLUDED.sales_revenue,
    gross_profit = EXCLUDED.gross_profit,
    expenses_total = EXCLUDED.expenses_total,
    net_result = EXCLUDED.net_result,
    finalized_by = EXCLUDED.finalized_by,
    finalized_at = EXCLUDED.finalized_at
  WHERE monthly_closings.status = 'draft'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'এই মাস ইতিমধ্যে ফাইনালাইজড — পুনরায় ফাইনালাইজ করা যাবে না। সংশোধন প্রয়োজন হলে correction_entries ব্যবহার করুন।';
  END IF;

  RETURN v_id;
END;
$$;

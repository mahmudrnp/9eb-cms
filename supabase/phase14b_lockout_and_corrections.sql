-- ============================================================
-- Phase 14b — Account Lockout (Open Issue সমাধান)
-- ৯ EB CMS
-- phase14_audit_security.sql-এর পরে রান করুন।
-- ============================================================

-- login_events.event_type-এ 'login_blocked' যোগ (একটা লকআউট-অবস্থায় থাকাকালীন
-- চেষ্টা করলে সেটাও আলাদাভাবে লগ হবে, 'login_failed' থেকে আলাদা করে চেনার জন্য)
ALTER TABLE login_events DROP CONSTRAINT login_events_event_type_check;
ALTER TABLE login_events ADD CONSTRAINT login_events_event_type_check
  CHECK (event_type IN ('login_success', 'login_failed', 'login_blocked', 'logout'));

DROP POLICY IF EXISTS login_events_insert ON login_events;
CREATE POLICY login_events_insert ON login_events FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid() AND event_type IN ('login_success', 'logout'))
  OR
  (auth.uid() IS NULL AND user_id IS NULL AND event_type IN ('login_failed', 'login_blocked'))
);

-- ============ check_login_lockout() — অ্যাপ-লেভেল অ্যাকাউন্ট-লকআউট ============
-- নীতি (ডিফল্ট প্রস্তাব, সাধারণ ইন্ডাস্ট্রি-প্র্যাকটিস অনুযায়ী — POLICY INPUT REQUIRED
-- যদি ভিন্ন থ্রেশহোল্ড/উইন্ডো চাওয়া হয়): শেষ ১৫ মিনিটে ৫ বার ব্যর্থ-লগইনের পর
-- সেই ইমেইলের জন্য লগইন ১৫ মিনিটের জন্য ব্লক। SECURITY DEFINER দিয়ে চলে যাতে
-- anon ক্লায়েন্ট সরাসরি login_events পড়তে না পেরেও শুধু "locked/না-locked" জানতে পারে
-- (raw log কখনো anon-কে দেখানো হয় না — শুধু boolean+countdown রিটার্ন হয়)।
CREATE OR REPLACE FUNCTION check_login_lockout(p_email TEXT)
RETURNS TABLE(locked BOOLEAN, seconds_remaining INT, failed_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_last_failed TIMESTAMPTZ;
  v_window INTERVAL := '15 minutes';
  v_max_attempts INT := 5;
BEGIN
  SELECT count(*), max(created_at) INTO v_count, v_last_failed
  FROM login_events
  WHERE event_type = 'login_failed'
    AND lower(email_attempted) = lower(p_email)
    AND created_at > now() - v_window;

  IF v_count >= v_max_attempts THEN
    RETURN QUERY SELECT true, GREATEST(0, EXTRACT(EPOCH FROM (v_last_failed + v_window - now()))::INT), v_count;
  ELSE
    RETURN QUERY SELECT false, 0, v_count;
  END IF;
END;
$$;

-- anon-কেও এক্সিকিউট-অনুমতি দিতে হবে — সাইন-ইন-চেষ্টার আগেই (unauthenticated অবস্থায়)
-- এটা কল হয়, তাই RPC নিজেই টেবিলের কোনো raw row এক্সপোজ করে না বলে নিরাপদ।
GRANT EXECUTE ON FUNCTION check_login_lockout(TEXT) TO anon, authenticated;

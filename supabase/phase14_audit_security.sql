-- ============================================================
-- Phase 14 — Audit + Security + Backup
-- ৯ EB CMS
-- Supabase SQL Editor-এ রান করুন schema.sql, rls_policies.sql,
-- fix_recorded_by_defaults.sql, phase07/08/11_functions.sql-এর পরে।
-- ============================================================

-- ============ login_events (লগইন/লগআউট/ব্যর্থ-চেষ্টা অডিট) ============
-- audit_logs টেবিলটা শুধু DB-টেবিল ট্রিগার থেকে আসে (INSERT/UPDATE/DELETE)।
-- Login/Logout কোনো টেবিল-রো পরিবর্তন করে না (এটা auth.users-এ ঘটে, যা আমাদের
-- schema-র বাইরে), তাই আলাদা টেবিল দরকার। Login-ব্যর্থ হলে ইউজার তখনো
-- authenticated না, তাই user_id সবসময় জানা যাবে না — email_attempted রাখা হলো
-- (শুধু ট্রেসিং/সন্দেহজনক-প্যাটার্ন শনাক্তের জন্য, পাসওয়ার্ড কখনো লগ হয় না)।
CREATE TABLE login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  email_attempted TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('login_success', 'login_failed', 'logout')),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_events_user ON login_events(user_id);
CREATE INDEX idx_login_events_date ON login_events(created_at);
CREATE INDEX idx_login_events_type ON login_events(event_type);

ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

-- SELECT: শুধু canteen_admin (User Management-এর সাথে সামঞ্জস্যপূর্ণ, Phase01 §৪)
CREATE POLICY login_events_select ON login_events FOR SELECT USING (current_role_name() = 'canteen_admin');

-- INSERT: একজন ইউজার নিজের login_success/logout-ই লিখতে পারবে (user_id = auth.uid());
-- login_failed শুধুমাত্র তখনই সম্ভব যখন কেউ authenticated না (তাই user_id অবশ্যই NULL) —
-- এটা ইচ্ছাকৃতভাবে anon-কে সীমিত INSERT-অনুমতি দেয় (শুধু এই একটা narrow shape),
-- যাতে ব্যর্থ-লগইন-চেষ্টাও অডিট-ট্রেইলে থাকে। কেউ এই লগ পড়তে পারবে না (SELECT canteen_admin-সীমিত),
-- শুধু flood/spam ঝুঁকি থাকে যা Supabase Auth-এর নিজস্ব রেট-লিমিটের বাইরেও সম্ভব —
-- এটা SECURITY_REVIEW.md-এ স্বীকৃত ঝুঁকি হিসেবে নথিভুক্ত।
CREATE POLICY login_events_insert ON login_events FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid() AND event_type IN ('login_success', 'logout'))
  OR
  (auth.uid() IS NULL AND user_id IS NULL AND event_type = 'login_failed')
);

CREATE POLICY login_events_no_update ON login_events FOR UPDATE USING (false);
CREATE POLICY login_events_no_delete ON login_events FOR DELETE USING (false);

-- ============ audit_logs — SELECT সীমাবদ্ধ করা (নিরাপত্তা-হার্ডেনিং) ============
-- Phase04-এ ভুলবশত সবার-জন্য-SELECT (USING true) দেওয়া হয়েছিল। audit_logs-এ
-- before/after_value JSONB-তে সব টেবিলের পূর্ণ রো (আর্থিক অঙ্কসহ) থাকে —
-- এটা শুধু oversight/accountability-এর কাজ, তাই canteen_admin-এ সীমিত করা হলো
-- (Phase01 §৪ ম্যাট্রিক্সে কোনো রোলকে স্পষ্টভাবে audit-view দেওয়া হয়নি,
-- এবং "least privilege" নীতি অনুযায়ী সবচেয়ে সংকীর্ণ ব্যাখ্যা নেওয়া হলো)।
DROP POLICY IF EXISTS audit_select ON audit_logs;
CREATE POLICY audit_select ON audit_logs FOR SELECT USING (current_role_name() = 'canteen_admin');

-- audit_system_insert অপরিবর্তিত থাকছে — trigger-চালিত ইনসার্ট + ম্যানুয়াল
-- report-export/login-event এন্ট্রির জন্য যেকোনো authenticated ইউজারের ইনসার্ট প্রয়োজন।

-- ============ audit_logs — report-export এন্ট্রির জন্য action-ভ্যালু নথিভুক্তি ============
-- কোনো নতুন কলাম/টেবিল লাগে না — ফ্রন্টএন্ড থেকে সরাসরি এভাবে ইনসার্ট হবে:
--   action='export', table_name='<report-name>', record_id=NULL,
--   after_value={"format":"csv|excel|pdf","row_count":N,"filters":{...}}
-- (src/lib/audit.ts → logExportEvent() দেখুন)

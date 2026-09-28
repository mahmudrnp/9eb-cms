-- ============================================================
-- হটফিক্স — "সংরক্ষণ করা যায়নি" এরর সমাধান (স্টক-সমন্বয়, সরবরাহকারী-পেমেন্ট ইত্যাদি)
-- কারণ: recorded_by কলাম NOT NULL, কিন্তু কিছু ফ্রন্টএন্ড ফর্ম থেকে সরাসরি INSERT করার সময়
-- এই ফিল্ড সেট করা হয়নি (RPC-ভিত্তিক ইনসার্টে auth.uid() ম্যানুয়ালি সেট হয়, কিন্তু সরাসরি
-- .insert() কলে হয়নি) — ফলে Postgres NOT NULL constraint ভায়োলেশন-এরর দিচ্ছিল।
-- সমাধান: DB-লেভেলে DEFAULT auth.uid() বসানো হলো, যাতে ভবিষ্যতে কোনো ইনসার্ট-কোড এই ফিল্ড
-- বাদ দিলেও স্বয়ংক্রিয়ভাবে সঠিক ইউজার-আইডি বসে যায়।
-- schema.sql-এর পরে যেকোনো সময় রান করা যায় (existing টেবিলে ALTER)।
-- ============================================================

ALTER TABLE stock_transactions ALTER COLUMN recorded_by SET DEFAULT auth.uid();
ALTER TABLE purchases ALTER COLUMN recorded_by SET DEFAULT auth.uid();
ALTER TABLE payments ALTER COLUMN recorded_by SET DEFAULT auth.uid();
ALTER TABLE supplier_payments ALTER COLUMN recorded_by SET DEFAULT auth.uid();
ALTER TABLE expenses ALTER COLUMN recorded_by SET DEFAULT auth.uid();
ALTER TABLE correction_entries ALTER COLUMN created_by SET DEFAULT auth.uid();

-- ============================================================
-- Phase 15 — Soldier Profile ফিল্ড সংযোজন
-- ৯ EB CMS
-- phase14b_lockout_and_corrections.sql-এর পরে রান করুন।
-- ============================================================

-- ব্যবহারকারীর সংশোধনী নির্দেশনা: ক্রমধারা সেনা নং → পদবি → নাম → কোম্পানি →
-- মোবাইল নাম্বার → মন্তব্য। soldiers টেবিলে মোবাইল ও মন্তব্য ফিল্ড ছিল না — যোগ করা হলো।
ALTER TABLE soldiers ADD COLUMN mobile_number TEXT;
ALTER TABLE soldiers ADD COLUMN remarks TEXT;

-- rank কলাম সবসময়ই free-text ছিল (কোনো ENUM/CHECK constraint নেই), তাই
-- "সিপাহী" → "সৈনিক" ইত্যাদি পরিভাষা-সংশোধন শুধু ফ্রন্টএন্ডে (SoldierForm.tsx-এর
-- placeholder/datalist) — কোনো স্কিমা-পরিবর্তন প্রয়োজন নেই, বিদ্যমান ডেটাও অক্ষত থাকে।

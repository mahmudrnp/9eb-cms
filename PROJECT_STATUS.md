# PROJECT STATUS — 9 EB Canteen Management System (CMS)

সর্বশেষ আপডেট: Phase 15–20 (ফিচার-সম্প্রসারণ) সম্পন্ন — সৈনিক-ফিল্ড সংশোধন, ব্যাচ-ভিত্তিক Expiry, বাল্ক-ইমপোর্ট, QR POS, বিক্রয়-অ্যানালিটিক্স, নতুন কালার-স্কিম

## ফেজ-অগ্রগতি
| ফেজ | অবস্থা |
|---|---|
| Phase 01 — Requirements & Constitution | ✅ অনুমোদিত (৩ রিভিশন) |
| Phase 02 — Architecture + Database + Accounting Model | ✅ অনুমোদিত |
| Phase 03 — UI/UX Design System | ✅ অনুমোদিত (২ রিভিশন — ক্রেস্ট-ইন্টিগ্রেশন) |
| Phase 04 — Authentication + RBAC | ✅ টেস্ট-সফল (canteen_admin লগইন ✓) |
| Phase 05 — Soldier Management | ✅ টেস্ট-সফল |
| Phase 06 — Product + Inventory | ✅ টেস্ট-সফল (হটফিক্সের পর) |
| Phase 07 — Purchase + Supplier | ✅ নির্মিত (atomic RPC) |
| Phase 08 — POS + Sales | ✅ টেস্ট-সফল (রসিদ + স্টক-হ্রাস কনফার্মড) |
| Phase 09 — Cash/Credit + Soldier Ledger | ✅ টেস্ট-সফল (বকেয়া-হিসাব কনফার্মড) |
| Phase 10 — Profit/Loss + Expenses | ✅ টেস্ট-সফল (P&L অংক কনফার্মড) |
| Phase 11 — Month-End Closing | ✅ টেস্ট-সফল (প্রিভিউ+ভ্যারিয়েন্স কনফার্মড) |
| Phase 12 — Dashboard + Alerts | ✅ টেস্ট-সফল (সব কার্ড লাইভ-ডেটা কনফার্মড) |
| Phase 13 — Reports + Export | 🔶 নির্মিত, ব্যবহারকারীর টেস্ট বাকি |
| Phase 14 (+14b) — Audit + Security + Backup | 🔶 নির্মিত (`tsc`+`build` ক্লিন), ব্যবহারকারীর টেস্ট বাকি |
| **Phase 15–20 — ফিচার-সম্প্রসারণ** (নিচে বিস্তারিত) | 🔶 নির্মিত (`tsc`+`build` ক্লিন, ৭২৩ মডিউল যাচাই), ব্যবহারকারীর টেস্ট বাকি |
| Phase 21 — Testing + QA (আগের রোডম্যাপের Phase15) | ⬜ |
| Phase 22 — Deployment + Documentation (আগের রোডম্যাপের Phase16) | ⬜ |

> **নোট:** মূল ১৬-ফেজ রোডম্যাপের বাইরে ব্যবহারকারীর অনুরোধে এই ৬টা ফিচার (সৈনিক-ফিল্ড, ব্যাচ-Expiry, বাল্ক-ইমপোর্ট, QR-POS, বিক্রয়-অ্যানালিটিক্স, রি-থিম) "Phase 15–20" নামে সন্নিবেশিত হলো — মূল Testing/Deployment ফেজ দুটো তাই 21/22-এ সরানো হয়েছে যাতে নম্বর-সংঘর্ষ না হয়।

## Phase 15–20-এ যা যোগ হলো
- **Phase 15:** সৈনিক-ফর্ম/তালিকায় মোবাইল+মন্তব্য ফিল্ড, সঠিক ফিল্ড-ক্রম, "সিপাহী"→"সৈনিক" পরিভাষা-সংশোধন (migration: `phase15_soldier_fields.sql`)
- **Phase 16:** `/inventory/expiry` — ব্যাচ-ভিত্তিক মেয়াদ-উত্তীর্ণ সতর্কতা (migration: `phase16_stock_batches_expiry.sql`, current_stock/COGS/P&L-এর গণনা অপরিবর্তিত রেখে সংযোজিত)
- **Phase 17:** `/soldiers/import`, `/purchases/import` — CSV/Excel বাল্ক-আমদানি (টেমপ্লেট-ডাউনলোড, প্রিভিউ, প্রতি-সারি ফলাফল)
- **Phase 18:** `/inventory/labels` (QR-লেবেল প্রিন্ট) + POS-এ ক্যামেরা QR-স্ক্যান (HTTPS/localhost আবশ্যক)
- **Phase 19:** `/reports/product-performance` — সর্বোচ্চ/সর্বনিম্ন বিক্রিত পণ্য, চার্টসহ
- **Phase 20:** পুরো অ্যাপের কালার-স্কিম গাঢ় সবুজ+মেরুনে পরিবর্তন, Dashboard রিডিজাইন (চার্ট, অ্যাকসেন্ট-কার্ড)
- **⚠️ ব্যবহারের আগে migration ক্রম: `phase15_soldier_fields.sql` → `phase16_stock_batches_expiry.sql` (আগের সবগুলোর পরে)**

## Phase 14-এ যা যোগ হলো
- `/audit` — অডিট লগ (তৈরি/সম্পাদনা/মুছে-ফেলা/এক্সপোর্ট), শুধু canteen_admin
- `/audit/logins` — লগইন-ইতিহাস (সফল/ব্যর্থ/লগআউট), শুধু canteen_admin
- `login_events` নতুন টেবিল + RLS (migration: `supabase/phase14_audit_security.sql`)
- `audit_logs` SELECT-পলিসি সংকুচিত (আগে সবাই দেখতে পারত → এখন canteen_admin-সীমিত)
- `supabase/BACKUP_RECOVERY.md`, `supabase/SECURITY_REVIEW.md` — নতুন ডকুমেন্টেশন

## Phase 14b-এ যা যোগ হলো (Open Issues সমাধান)
- `/corrections` — Correction Entry UI (শুধু canteen_admin), Phase02-এই-তৈরি `correction_entries` টেবিলের প্রথম UI
- `/settings/security` — TOTP 2FA এনরোলমেন্ট/নিষ্ক্রিয়করণ (সব রোল, নিজের-অ্যাকাউন্ট)
- অ্যাকাউন্ট-লকআউট — ১৫ মিনিটে ৫-বার ব্যর্থ-লগইনের পর ১৫ মিনিট ব্লক (RPC: `check_login_lockout`)
- **⚠️ ব্যবহারের আগে `supabase/phase14_audit_security.sql` তারপর `supabase/phase14b_lockout_and_corrections.sql` — দুটোই SQL Editor-এ ক্রমানুসারে রান করতে হবে**

## চূড়ান্ত নীতিগত সিদ্ধান্ত (সারসংক্ষেপ)
- ব্যাকএন্ড: **Supabase/PostgreSQL**
- রোল: **৩টা** — canteen_admin, sales_operator, viewer (Super Admin/Inventory Operator/Accountant → canteen_admin-এ একীভূত)
- মূল্য: ফিক্সড-রেট | ক্রেডিট: সীমাহীন | ট্যাক্স/VAT: প্রযোজ্য নয় | হিসাব-পদ্ধতি: Accrual
- মাস-ক্লোজিং: প্রতি মাসের ২৫ তারিখ, canteen_admin ফাইনালাইজ করে
- সরবরাহকারী-বকেয়া ট্র্যাক করা হয়
- লেনদেন কখনো এডিট/ডিলিট হয় না — শুধু correction_entries
- অনলাইন পেমেন্ট: bKash/Nagad/SSLCommerz (ইন্টিগ্রেশন-পথ এখনো POLICY INPUT REQUIRED)
- ব্র্যান্ড: অফিসিয়াল "Charging Nine" রেজিমেন্টাল ক্রেস্ট, ক্রেস্ট-রেড (#AC1D21) শুধু আইডেন্টিটিতে, navy (#1F2D3A) প্রাইমারি-অ্যাকশনে

## এখনো খোলা (POLICY/TECH INPUT REQUIRED)
- ডিসকাউন্ট %-ক্যাপ (নির্দিষ্ট সংখ্যা)
- পেমেন্ট-গেটওয়ে ইন্টিগ্রেশন-পথ (SSLCommerz-only vs bKash+Nagad সরাসরি), ব্যবহারের-ক্ষেত্র, মার্চেন্ট-অ্যাকাউন্ট, রিফান্ড-নীতি
- রেজিমেন্টাল-ইনসিগনিয়া ছাড়া অন্য কোনো ব্র্যান্ডিং প্রয়োজন কিনা
- Supabase প্ল্যান/PITR ব্যাকআপ-সিদ্ধান্ত (`supabase/BACKUP_RECOVERY.md` §৫) — আমি নিজে করতে পারি না, ব্যবহারকারীর Supabase Dashboard-অ্যাক্সেস লাগবে
- পাবলিক সাইন-আপ Supabase Dashboard থেকে বন্ধ করা (ম্যানুয়াল-টগল, `supabase/SECURITY_REVIEW.md` §৭) — একইভাবে Dashboard-অ্যাক্সেস লাগবে
- অ্যাকাউন্ট-লকআউটের থ্রেশহোল্ড (এখন ডিফল্ট ৫-বার/১৫-মিনিট, নিশ্চিতকরণ প্রয়োজন হলে জানাবেন)

## Tech Stack
React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + React Router + Supabase (Postgres/Auth/Storage/Edge Functions) + xlsx (CSV/Excel) + recharts (চার্ট) + qrcode + jsqr (QR লেবেল/স্ক্যান)

## কিভাবে চালাবেন (ডেভেলপমেন্ট)
```
cd cms
cp .env.example .env   # তারপর প্রকৃত Supabase URL/anon-key বসান
npm install
npm run dev
```
প্রোডাকশন Supabase প্রজেক্টে schema (Phase02 SQL) + supabase/rls_policies.sql রান করতে হবে auth কাজ করার আগে।

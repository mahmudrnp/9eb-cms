# CHANGELOG — 9 EB CMS

## [Phase 15–20] — ফিচার-সম্প্রসারণ: সৈনিক-ফিল্ড সংশোধন, বাল্ক-ইমপোর্ট, ব্যাচ-ভিত্তিক Expiry, QR POS, বিক্রয়-অ্যানালিটিক্স, নতুন কালার-স্কিম

### Phase 15 — সৈনিক-প্রোফাইল ফিল্ড সংশোধন
- `soldiers` টেবিলে `mobile_number`, `remarks` কলাম যোগ (migration: `phase15_soldier_fields.sql`)
- ফিল্ড-ক্রম সংশোধন: সেনা নং → পদবি → নাম → কোম্পানি → প্লাটুন → মোবাইল নাম্বার → মন্তব্য → স্ট্যাটাস (ফর্ম + তালিকা উভয়ে)
- "সিপাহী" (বর্তমানে অপ্রচলিত পরিভাষা) সরিয়ে "সৈনিক" ব্যবহার; পদবি-ফিল্ডে একটা datalist সাজেশন যোগ (সৈনিক/ল্যান্স কর্পোরাল/কর্পোরাল/সার্জেন্ট/স্টাফ সার্জেন্ট/ওয়ারেন্ট অফিসার/নায়েক সুবেদার/সুবেদার) — তবে এখনো free-text, তালিকার বাইরের বৈধ পদবিও লেখা যায়

### Phase 16 — ব্যাচ-ভিত্তিক মেয়াদ-উত্তীর্ণ (Expiry) ট্র্যাকিং
- `stock_batches` নতুন টেবিল + `purchase_items.expiry_date` কলাম (migration: `phase16_stock_batches_expiry.sql`)
- **ডিজাইন-নীতি (গুরুত্বপূর্ণ):** এই পুরো ফিচারটা current_stock/COGS/P&L-এর বিদ্যমান, ইতিমধ্যে-টেস্ট-করা গণনা-লজিক একটুও বদলায়নি — সম্পূর্ণ সংযোজিত (additive) একটা পার্শ্ব-স্তর, শুধু "কোন ব্যাচের মেয়াদ কবে শেষ" ট্র্যাক করার জন্য
- ট্রিগার-চালিত: ক্রয়-লাইন তৈরি হলে স্বয়ংক্রিয় ব্যাচ তৈরি হয়; স্টক কমলে (বিক্রয়/ক্ষতিগ্রস্ত/সমন্বয়) সবচেয়ে কাছের-মেয়াদের ব্যাচ থেকে আগে বিয়োগ হয় (FIFO-by-expiry) — best-effort, ব্যাচ অপর্যাপ্ত থাকলেও কখনো মূল বিক্রয়/সমন্বয়-ফ্লো ব্লক করে না
- `/inventory/expiry` — মেয়াদ-উত্তীর্ণ/শীঘ্রই-শেষ-হতে-যাওয়া ব্যাচের তালিকা (৭/১৫/৩০/৯০ দিন ফিল্টার)
- ক্রয়-এন্ট্রি ফর্মে প্রতিটা লাইনে ঐচ্ছিক মেয়াদ-তারিখ ইনপুট
- Dashboard-এ "মেয়াদ শীঘ্রই শেষ" অ্যালার্ট কার্ড (আগামী ১৪ দিন) — `stock_batches` migration রান না করা থাকলেও ড্যাশবোর্ড ভাঙে না (চুপচাপ ০ দেখায়)

### Phase 17 — বাল্ক CSV/Excel আমদানি (সৈনিক + ক্রয়)
- `src/lib/bulkImport.ts` — xlsx (SheetJS, আগে থেকেই dependency) দিয়ে CSV ও Excel উভয় পার্স
- `/soldiers/import` — কলাম: সেনা_নং, পদবি, নাম, কোম্পানি (নাম না মিললে স্বয়ংক্রিয় তৈরি), মোবাইল_নাম্বার, মন্তব্য
- `/purchases/import` — কলাম: সরবরাহকারী, ইনভয়েস, তারিখ, পণ্য, পরিমাণ, একক_মূল্য, মেয়াদ (ঐচ্ছিক), পেমেন্ট_স্ট্যাটাস — একই সরবরাহকারী+ইনভয়েস+তারিখের একাধিক সারি একটা ক্রয়ে (একাধিক লাইন-আইটেম) গ্রুপ হয়ে `create_purchase_with_items` RPC-এর মাধ্যমেই সংরক্ষিত হয় (কোনো নতুন RPC/বাইপাস না)
- উভয় পাতায়: নমুনা-টেমপ্লেট ডাউনলোড, প্রিভিউ-টেবিল, প্রতি-সারি সফল/ব্যর্থ ফলাফল
- পণ্য/সরবরাহকারী নাম হুবহু মিলতে হবে (case-insensitive) — না মিললে সেই সারি ব্যর্থ দেখাবে, বাকি সারি চলতে থাকবে

### Phase 18 — QR-কোড লেবেল + POS QR-স্ক্যান
- `/inventory/labels` — প্রতিটা সক্রিয় পণ্যের জন্য নিজস্ব QR কোড (`qrcode` লাইব্রেরি) জেনারেট + প্রিন্ট-উপযোগী গ্রিড-লেআউট (৩-কলাম, লেবেল-স্টিকারের মাপ)
- QR-কনটেন্ট ফরম্যাট: `9EBCMS:PRODUCT:<পণ্য-আইডি>`
- `src/components/QrScanner.tsx` — ক্যামেরা দিয়ে লাইভ-স্ক্যান (`jsqr`, হালকা, কোনো ভারী dependency ছাড়া); POS পাতায় "📷 QR স্ক্যান" বাটন — স্ক্যান হলে সরাসরি কার্টে যোগ হয়
- **⚠️ মনে রাখার বিষয়:** ব্রাউজার ক্যামেরা-অ্যাক্সেসের জন্য HTTPS (অথবা localhost) আবশ্যক — প্রোডাকশনে http:// থেকে কাজ করবে না

### Phase 19 — বিক্রয়-অ্যানালিটিক্স (কী বেশি/কম বিক্রি হচ্ছে)
- `src/lib/analytics.ts` — sale_items থেকে সরাসরি live-aggregate (কোনো স্টোরড-সামারি না, Phase01 নীতি অনুযায়ী)
- `/reports/product-performance` — শীর্ষ-১০ ও সর্বনিম্ন-১০ বিক্রিত পণ্য, বার-চার্ট (recharts) + টেবিল, তারিখ-রেঞ্জ ফিল্টার, CSV/Excel/PDF এক্সপোর্ট

### Phase 20 — পুরো অ্যাপ কালার-স্কিম পরিবর্তন + এন্টারপ্রাইজ Dashboard
- `src/index.css` — `--color-navy` এখন গাঢ় সবুজ (`#14432A`, আর্মি-ব্র্যান্ড), `--color-crest-red` এখন মেরুন (`#6E1423`, রেজিমেন্ট-কালার) — ভ্যারিয়েবল-নাম অপরিবর্তিত রাখা হয়েছে (৩০+ ফাইলে ব্যবহৃত), শুধু মান বদলানো হয়েছে, তাই পুরো অ্যাপ একসাথে নতুন রঙে আপডেট হয়েছে
- `src/lib/export.ts`-এর PDF-প্রিন্ট হেডার-রঙও নতুন সবুজে আপডেট
- Dashboard সম্পূর্ণ রিডিজাইন: হেডার-ব্যান্ড, অ্যাকসেন্ট-বর্ডারযুক্ত স্ট্যাট-কার্ড, গত-৭-দিনের বিক্রয়-প্রবণতা AreaChart, পেমেন্ট-বিভাজন PieChart (recharts, নতুন dependency), মেয়াদ-উত্তীর্ণ অ্যালার্ট কার্ড

### Verified
- `tsc -b` ক্লিন পাস; placeholder `.env` দিয়ে `npm run build` করে নিশ্চিত করা হয়েছে সব নতুন কোড (৭২৩ মডিউল) বান্ডলে ঠিকভাবে আছে

### ⚠️ Migration Required (ক্রমানুসারে)
`phase15_soldier_fields.sql` → `phase16_stock_batches_expiry.sql` (আগের সব migration-এর পরে)

### Open Issues / সীমাবদ্ধতা (সততার সাথে স্বীকৃত)
- ব্যাচ-consumption trigger best-effort — migration-এর আগে কেনা পুরনো স্টকের কোনো ব্যাচ-রেকর্ড নেই, তাই সেসবের expiry ট্র্যাক হবে না (শুধু migration-পরবর্তী নতুন ক্রয়ের জন্য প্রযোজ্য)
- বাল্ক-ইমপোর্টে সরাসরি সৈনিক/প্ল্যাটুন-লেভেল বরাদ্দ নেই (শুধু কোম্পানি) — প্ল্যাটুন পরে এডিট করে যোগ করতে হবে
- QR ক্যামেরা-স্ক্যান HTTPS ছাড়া কাজ করবে না (ব্রাউজার-সীমাবদ্ধতা, কোড-ইস্যু না)
- রঙ-পরিবর্তন CSS-টোকেন-স্তরে হওয়ায় visual QA (স্ক্রিনশট নিয়ে বাস্তবে দেখা) এখনো বাকি — কনট্রাস্ট/রিডেবিলিটি লোকালি যাচাই করার অনুরোধ

## [Phase 14b] — Open Issues সমাধান (Correction Entries UI, Account Lockout, MFA)
এই কাজটা Phase14-সমাপ্তির রিপোর্টে নথিভুক্ত "Open Issues"-এর মধ্যে যা কোড দিয়ে সমাধানযোগ্য তার জবাব — কোনো নতুন হিসাব-নিয়ম বা নীতি উদ্ভাবন ছাড়াই।

### Added — Correction Entries UI
- `src/lib/corrections.ts` + `/corrections` পাতা (শুধু canteen_admin) — Phase02-এই তৈরি-হওয়া `correction_entries` টেবিল/RLS-এর জন্য প্রথমবারের-মতো UI। মূল-রেকর্ড ৬টা লেনদেন-টেবিল (sales/purchases/stock_transactions/payments/expenses/supplier_payments) থেকে সার্চ করে নির্বাচন, কারণ, adjustment/reversal ধরন, এবং ঐচ্ছিকভাবে ইতিমধ্যে-তৈরি-হওয়া প্রকৃত সংশোধনী-রেকর্ডের সাথে লিংক
- **স্থাপত্যগত সিদ্ধান্ত (স্পষ্টভাবে বলা প্রয়োজন):** `correction_entries` টেবিলের স্কিমা (Phase02) নিজে কোনো টাকা/পরিমাণ ধারণ করে না — এটা শুধু "কোনটা, কেন, কী দিয়ে সংশোধিত" তার নথি। তাই এই UI প্রকৃত সংশোধনী-লেনদেন (নতুন stock adjustment/payment/expense) নিজে তৈরি করে না — সেটা আগে-থেকেই-থাকা যথাযথ মডিউল দিয়ে আলাদাভাবে করে এখানে এসে লিংক করতে হয়। একটা সম্পূর্ণ "sale reversal engine" (স্টক+লেজার+রাজস্ব একসাথে বিপরীত করা) তৈরি করা হয়নি, কারণ সেটা নতুন হিসাব-নিয়ম উদ্ভাবন হয়ে যেত (approval-flow, মাস-লকের সাথে interaction ইত্যাদি অনির্দিষ্ট) — এই সিদ্ধান্ত ব্যবহারকারীর অনুমোদন সাপেক্ষ

### Added — Account Lockout
- `supabase/phase14b_lockout_and_corrections.sql` — **নতুন migration**:
  - `login_events.event_type`-এ `'login_blocked'` যোগ
  - `check_login_lockout(p_email)` RPC (SECURITY DEFINER) — শেষ ১৫ মিনিটে ৫-বার ব্যর্থ-লগইনের পর সেই ইমেইল ১৫ মিনিটের জন্য ব্লক (ডিফল্ট-প্রস্তাবিত থ্রেশহোল্ড — **POLICY INPUT REQUIRED** যদি ভিন্ন সংখ্যা চাওয়া হয়); anon-কে শুধু boolean+countdown রিটার্ন করে, raw লগ কখনো এক্সপোজ করে না
- `AuthContext.signIn()` — Supabase Auth কল করার আগেই লকআউট-চেক করে; ব্লকড হলে মিনিট-কাউন্টডাউনসহ বার্তা দেখায় এবং `login_blocked` ইভেন্ট লগ করে

### Added — TOTP MFA (2FA)
- `src/pages/Settings/SecuritySettings.tsx` (`/settings/security`, সব রোলের জন্য নিজের-অ্যাকাউন্ট) — QR-কোড দিয়ে TOTP এনরোলমেন্ট (Google Authenticator/Authy), নিষ্ক্রিয় করার সুবিধা
- `src/components/MfaChallengeScreen.tsx` + `AuthContext` — পাসওয়ার্ড-সাইন-ইনের পরেও aal2 না-হওয়া পর্যন্ত পুরো অ্যাপ ব্লকড থাকে (২FA-এনরোলড ইউজারদের জন্যই শুধু প্রযোজ্য, বাকিদের কোনো প্রভাব নেই)
- Supabase-এর বিল্ট-ইন Auth MFA API ব্যবহৃত — কোনো Dashboard-কনফিগ/Edge Function লাগে না

### Verified
- placeholder `.env` দিয়ে `npm run build` করে নিশ্চিত করা হয়েছে যে সব নতুন কোড (Phase13+14+14b) আসল bundle-এ ঠিকভাবে অন্তর্ভুক্ত হচ্ছে (আগে `.env` ছাড়া বিল্ড করলে Vite `import.meta.env`-কে `undefined` দিয়ে রিপ্লেস করে, ফলে `supabaseClient.ts`-এর গার্ড-ক্লজ unconditionally throw করে এবং Rollup পুরো অ্যাপ-কোড dead-code হিসেবে ফেলে দেয় — এটা শুধু sandbox-এ ঘটে, `.env` থাকা আসল ব্যবহারে এই সমস্যা নেই, কিন্তু ভবিষ্যতে যাচাইয়ের সময় মনে রাখা জরুরি)
- `tsc -b` ক্লিন পাস

### ⚠️ Migration Required
`supabase/phase14b_lockout_and_corrections.sql` রান করুন (`phase14_audit_security.sql`-এর পরে)। `correction_entries` টেবিল/RLS-এর জন্য নতুন migration লাগবে না — Phase02-এই তৈরি।

### Open Issues (এখনো বাকি, নীতিগত/অপারেশনাল সিদ্ধান্ত দরকার — কোড দিয়ে সমাধানযোগ্য না)
- Supabase-এ পাবলিক সাইন-আপ বন্ধ করা — Dashboard-এ ম্যানুয়াল টগল, আমি নিজে করতে পারি না (কোনো API/access token নেই)
- PITR/ব্যাকআপ-প্ল্যান চূড়ান্ত করা — কোন Supabase প্ল্যান ব্যবহৃত হচ্ছে তার ওপর নির্ভরশীল, ব্যবহারকারীর ইনপুট দরকার

## [Phase 14] — Audit + Security + Backup
### Added
- `supabase/phase14_audit_security.sql` — **নতুন SQL migration**:
  - `login_events` টেবিল — login_success/login_failed/logout প্রতিটা একটা নতুন-রো (কখনো ওভাররাইট না), RLS: SELECT শুধু canteen_admin, INSERT নিজের login_success/logout-এই সীমিত (authenticated) বা anon-এর login_failed-এই সীমিত (unauthenticated অবস্থায় ব্যর্থ-চেষ্টা লগ করতে)
  - `audit_logs` SELECT পলিসি সংশোধন — আগে `USING (true)` (সবাই দেখতে পারত) → এখন শুধু canteen_admin (নিরাপত্তা-হার্ডেনিং, least-privilege)
- `src/lib/audit.ts` — অডিট-লগ/লগইন-ইতিহাস ফেচ (ফিল্টার+পেজিনেশন) ও লগ-লেখার হেল্পার (`logLoginEvent`, `logExportEvent`)
- **অডিট লগ পাতা** (`/audit`) — সব তৈরি/সম্পাদনা/মুছে-ফেলা/এক্সপোর্ট কার্যক্রম, তারিখ/অ্যাকশন/টেবিল-ফিল্টার, প্রতিটা এন্ট্রি ক্লিক করলে আগে/পরে JSON বিস্তারিত দেখা যায়
- **লগইন-ইতিহাস পাতা** (`/audit/logins`) — সফল/ব্যর্থ লগইন ও লগআউট ইভেন্ট, তারিখ/ধরন-ফিল্টার, ব্যর্থ-চেষ্টার সংখ্যা হাইলাইট
- উভয় পাতা রিপোর্ট-হাবে (`/reports`) "নিরাপত্তা ও অডিট" সেকশনে যোগ (শুধু canteen_admin-এর কাছে দৃশ্যমান)
- `AuthContext.signIn()`/`signOut()` — এখন প্রতিটা লগইন-সফল/ব্যর্থ/লগআউট স্বয়ংক্রিয়ভাবে `login_events`-এ লগ হয় (ব্যর্থ হলেও মূল অথ-ফ্লো কখনো ব্লক হয় না)
- `ExportBar` — প্রতিটা CSV/Excel/PDF এক্সপোর্ট ক্লিকে `audit_logs`-এ `action='export'` এন্ট্রি (রিপোর্ট-নাম, ফরম্যাট, রো-সংখ্যা)
- `supabase/BACKUP_RECOVERY.md` — Supabase বিল্ট-ইন ব্যাকআপ/PITR ব্যাখ্যা, ম্যানুয়াল `pg_dump`/`pg_restore` পদ্ধতি, দুর্যোগ-পুনরুদ্ধার-সারণি
- `supabase/SECURITY_REVIEW.md` — Auth/RBAC/Input-validation/Audit/Secrets পর্যালোচনা-চেকলিস্ট, পাওয়া-যাওয়া গ্যাপ (audit_logs অতি-উন্মুক্ত ছিল, এখন সংশোধিত) ও গ্রহণযোগ্য-ঝুঁকির স্পষ্ট তালিকা

### Verified
- `tsc -b` ও `npm run build` — দুটোই ক্লিন পাস

### ⚠️ Migration Required
Supabase SQL Editor-এ `supabase/phase14_audit_security.sql` রান করতে হবে (schema.sql, rls_policies.sql, fix_recorded_by_defaults.sql, phase07/08/11_functions.sql-এর পরে, যেকোনো ক্রমে যেহেতু অন্য migration-এর ওপর নির্ভরশীল না — শুধু `current_role_name()` ফাংশন লাগে যেটা rls_policies.sql-এ আগে থেকেই আছে)।

### Security
- **audit_logs-এর SELECT-অ্যাক্সেস সংকুচিত** — Phase04-এ ভুলবশত সবাই দেখতে পারত (before/after JSONB-তে পূর্ণ আর্থিক-রো থাকে); এখন canteen_admin-সীমিত
- অডিট-লগ ও লগইন-ইতিহাস উভয়ই tamper-প্রুফ — UPDATE/DELETE RLS-এ সম্পূর্ণ ব্লকড, canteen_admin-ও পারবে না (accountability বজায় রাখতে)
- লগইন-লগিং ব্যর্থ হলেও (নেটওয়ার্ক-সমস্যা ইত্যাদি) সাইন-ইন/আউট ফ্লো কখনো আটকায় না — try/catch দিয়ে silently সরে যায়

### Notes/Scope (সততার সাথে স্বীকৃত সীমাবদ্ধতা)
- Correction-entry তৈরির UI এখনো নেই (Phase01 §৪/১১-এ নীতি হিসেবে চূড়ান্ত হয়েছিল — "কখনো এডিট/ডিলিট না, শুধু correction-entry" — কিন্তু `correction_entries` টেবিলে ইনসার্ট করার কোনো ফর্ম এখনো তৈরি হয়নি কোনো ফেজে; ভবিষ্যতে আলাদা ছোট-ফেজ হিসেবে যোগ করা প্রয়োজন — **Open Issue নিচে**)
- অ্যাকাউন্ট-লকআউট (N-বার ব্যর্থ লগইনের পর ব্লক) এই ফেজে বাস্তবায়িত হয়নি — `SECURITY_REVIEW.md` §৬-এ গ্রহণযোগ্য-ঝুঁকি হিসেবে নথিভুক্ত, ভিত্তি (login_events) এখন প্রস্তুত থাকায় ভবিষ্যতে Edge Function দিয়ে সহজে যোগ করা যাবে
- MFA/2FA বাস্তবায়িত হয়নি — Supabase Auth সাপোর্ট করে, ভবিষ্যতে প্রয়োজন হলে যোগ করা সম্ভব

### Open Issues (পরবর্তী ফেজে বিবেচনার জন্য)
- Correction-entry UI তৈরি করা হয়নি — Phase15 (Testing+QA)-এর আগে অথবা আলাদা ছোট hotfix-ফেজ হিসেবে যোগ করা উচিত
- Supabase প্ল্যান/PITR সিদ্ধান্ত এখনো POLICY/OPS INPUT REQUIRED (`BACKUP_RECOVERY.md` §৫)
- পাবলিক সাইন-আপ Supabase Dashboard থেকে বন্ধ করা এখনো ম্যানুয়াল-অ্যাকশন হিসেবে বাকি (`SECURITY_REVIEW.md` §৭)

## [Phase 13] — Reports + Export
### Added
- **সাধারণীকৃত এক্সপোর্ট-ইউটিলিটি** (`src/lib/export.ts`) — CSV, Excel (xlsx, lazy-loaded), PDF (popup-window + window.print(), Phase01 §১-এর MT Tracker Pro প্যাটার্ন অনুসরণ করে ক্রেস্ট-লেটারহেড সহ)
- পুনর্ব্যবহারযোগ্য `<ExportBar/>` কম্পোনেন্ট — যেকোনো তালিকা-পাতায় ৩-ক্লিকে CSV/Excel/PDF
- এক্সপোর্ট-বাটন যোগ হলো: ইনভেন্টরি, বিক্রয়-তালিকা, বকেয়া-তালিকা, লাভ-ক্ষতি রিপোর্ট, খরচ
- **নতুন রিপোর্ট:** স্টক মুভমেন্ট (`/reports/stock-movement`) — সব স্টক-ইন/আউট/সমন্বয়/ক্ষতিগ্রস্ত/মেয়াদোত্তীর্ণ লেনদেন, তারিখ-ফিল্টার
- **রিপোর্ট-হাব** (`/reports`) — ইনভেন্টরি/বিক্রয়/ক্রেডিট/আর্থিক ক্যাটাগরিতে সাজানো, রোল-অনুযায়ী ফিল্টার্ড

### Verified
- `tsc -b` ও `npm run build` — দুটোই ক্লিন পাস
- **পারফরম্যান্স-ফিক্স:** `xlsx` লাইব্রেরি (৪২৪ KB) lazy-load করা হয়েছে — শুধু Excel-বাটনে ক্লিক করলে লোড হয়, মূল বান্ডলে যোগ হয় না (মোবাইল-ফার্স্ট নীতি)

### Notes/Scope (সৎ-ভাবে স্বীকৃত সীমাবদ্ধতা)
Phase01 §১০-এ তালিকাভুক্ত সব রিপোর্ট আলাদা পাতা হিসেবে তৈরি হয়নি — বরং বিদ্যমান তালিকা-পাতাগুলোতে (যেগুলো একই ডেটা দেখায়) এক্সপোর্ট-সক্ষমতা যোগ করা হয়েছে, যা কার্যত একই ফলাফল দেয়:
- Product-wise/Soldier-wise sales, Aging report — এই মুহূর্তে আলাদা পাতা নেই, তবে বিক্রয়-রিপোর্ট ও বকেয়া-তালিকা এক্সপোর্ট করে প্রয়োজনীয় ডেটা পাওয়া যায়
- Damaged/Expired-শুধু রিপোর্ট — স্টক-মুভমেন্ট রিপোর্টেই আছে (ধরন-কলাম দিয়ে ফিল্টার করা যায়, Excel-এ)
- ভবিষ্যতে প্রয়োজন হলে এই সংকীর্ণ রিপোর্টগুলো আলাদা পাতা হিসেবে যোগ করা যাবে (একই `ExportBar`/`export.ts` পুনর্ব্যবহার করে দ্রুত করা সম্ভব)

## [Phase 12] — Dashboard + Alerts
### Added
- পূর্ণাঙ্গ ড্যাশবোর্ড (`/`) — Phase01 §৮-এর সব উপাদান: মোট স্টক-মূল্য, আজকের/মাসিক বিক্রয়, নগদ/বাকি/আংশিক ভিজ্যুয়াল-বার, মোট বকেয়া, মাসিক ক্রয়-মূল্য, মাসিক গ্রস-প্রফিট (শুধু canteen_admin/viewer), সক্রিয় পণ্য-সংখ্যা, লো-স্টক পণ্য, সাম্প্রতিক লেনদেন, সর্বোচ্চ-বকেয়া সৈনিক
- সবার আগে গুরুত্বপূর্ণ অ্যালার্ট (লো-স্টক, মোট-বকেয়া) — Phase03 নীতি: দ্রুত-স্ক্যানযোগ্য
- `src/lib/dashboard.ts` — সব সংখ্যা সমান্তরাল Promise.all দিয়ে লাইভ-কোয়েরি, কোনো ক্যাশড-সামারি-টেবিল না

### Verified
- `tsc -b` ও `npm run build` — দুটোই ক্লিন পাস

### Notes
- আর্থিক-সংবেদনশীল কার্ড (ক্রয়-মূল্য, গ্রস-প্রফিট) Sales Operator থেকে লুকানো, Phase01 §৪ ম্যাট্রিক্স অনুযায়ী
- রোল-নির্বিশেষে সবাই স্টক/বিক্রয়/বকেয়া-সংক্রান্ত কার্ড দেখতে পারে

## [Phase 11] — Month-End Closing
### Added
- `supabase/phase11_functions.sql` — **নতুন SQL migration**: `stock_value_as_of()`, `monthly_closing_preview()` (লাইভ স্টক-রিকনসিলিয়েশন + আর্থিক-সারাংশ), `finalize_month_closing()` (atomic, একবারই ফাইনালাইজ করা যায়)
- মাস-সমাপনী পাতা (`/month-closing`) — শুরু/শেষ-তারিখ (ডিফল্ট ২৬-২৫ চক্র), লাইভ প্রিভিউ (Opening+Purchased−Sold±Adjustments=Expected Closing + P&L সারাংশ), ফিজিক্যাল-স্টক ইনপুট, ভ্যারিয়েন্স, দুই-ধাপ কনফার্মেশন সহ ফাইনালাইজ, পূর্ববর্তী ক্লোজিং-ইতিহাস
- `src/lib/monthClosing.ts`

### Verified
- `tsc -b` ও `npm run build` — দুটোই ক্লিন পাস

### ⚠️ Migration Required
Supabase SQL Editor-এ `supabase/phase11_functions.sql` রান করুন (schema, rls_policies, phase07/08_functions-এর পরে)।

### Notes/Simplifications (স্বীকৃত সীমাবদ্ধতা)
- **স্টক-মূল্যায়ন সবসময় বর্তমান ক্রয়-মূল্যে** (FIFO/weighted-average costing নয়) — সরল কিন্তু ঐতিহাসিক-মূল্য-পরিবর্তনের ক্ষেত্রে নির্ভুল না; ভবিষ্যতে প্রয়োজন হলে আলাদা costing-মডেল যোগ করা যাবে
- **ফিজিক্যাল-কাউন্ট এই ফেজে একটা সামগ্রিক টাকার-অঙ্ক হিসেবে ইনপুট** (প্রতি-পণ্য কাউন্ট-ফর্ম না) — প্রতি-পণ্য ফিজিক্যাল-কাউন্ট UI একটা বড় সংযোজন, ভবিষ্যতে প্রয়োজনমতো যোগ করা যাবে
- ফাইনালাইজেশন সরাসরি — আলাদা "ড্রাফট সেভ" ধাপ এখনো UI-তে নেই (RPC-তে সাপোর্ট আছে, ভবিষ্যতে UI যোগ করা যাবে)
- ফাইনালাইজড মাসের লেনদেন write-protection RLS-এর ওপর নির্ভরশীল নয় এখনো (sales/purchases ইত্যাদি এমনিতেই সবসময় ইমিউটেবল, তাই আলাদা "মাস-লক" চেক আপাতত অপ্রয়োজনীয়; ভবিষ্যতে সময়ের-ভিত্তিতে নতুন এন্ট্রি ব্লক করার প্রয়োজন হলে আলাদা পলিসি লাগবে)

## [Phase 10] — Profit/Loss + Expenses
### Added
- খরচ-পাতা (`/expenses`) — ক্যাটাগরি/পরিমাণ/তারিখ/বিবরণ, শুধু canteen_admin তৈরি করতে পারে, সবাই দেখতে পারে
- লাভ-ক্ষতি রিপোর্ট (`/reports/profit-loss`) — আজ/এই-মাস/কাস্টম-রেঞ্জ প্রিসেট, Phase02-এর `profit_loss()` SQL ফাংশন থেকে লাইভ (Sales Revenue, COGS, Gross Profit, Expenses, Net Result) — শুধু canteen_admin + viewer (sales_operator নয়, Phase01 §৪ ম্যাট্রিক্স)
- `src/lib/finance.ts` — খরচ ও P&L ডেটা-অ্যাক্সেস
- Dashboard-এ অস্থায়ী দ্রুত-অ্যাক্সেস লিংক (পূর্ণাঙ্গ কার্ড Phase12-এ)

### Verified
- `tsc -b` ও `npm run build` — দুটোই ক্লিন পাস

### Notes
- কোনো নতুন SQL migration লাগেনি — Phase02-এর `profit_loss()` ফাংশন ও `expenses` টেবিল/RLS আগে থেকেই প্রস্তুত ছিল
- রিপোর্টের নিচে Phase01 §৬.৫-এর স্পষ্ট পার্থক্য (Revenue≠Cash, Purchase≠COGS) মনে করিয়ে দেওয়া হয়েছে

## [Phase 09] — Cash/Credit + Soldier Ledger
### Added
- সৈনিক-লেজার পাতায় "পেমেন্ট নিন" ফর্ম — বকেয়া-আদায় এন্ট্রি (canteen_admin + sales_operator, Phase01 রিভিশন৩ সিদ্ধান্ত অনুযায়ী), সর্বোচ্চ বকেয়া-পরিমাণে ক্যাপড, শুধু নতুন `payments` এন্ট্রি (কখনো ওভাররাইট নয়)
- বকেয়া-আদায় ওভারভিউ পাতা (`/credit`) — সব বকেয়া-থাকা সৈনিক বেশি-থেকে-কম সাজানো (`soldier_ledger` VIEW থেকে লাইভ), মোট-বকেয়া সারাংশ
- `recordSoldierPayment()`, `fetchOutstandingSoldiers()` — `src/lib/soldiers.ts`-এ যোগ
- পেমেন্ট-মেথড লেবেল বাংলায় অনুবাদ (নগদ)

### Verified
- `tsc -b` ও `npm run build` — দুটোই ক্লিন পাস (একটা ছোট syntax-এরর ডেভেলপমেন্টের সময় ধরা পড়ে ঠিক করা হয়েছে)

### Notes
- কোনো নতুন SQL migration লাগেনি — বিদ্যমান `payments` টেবিল ও RLS পলিসি ব্যবহার করা হয়েছে
- `recorded_by` স্পষ্টভাবে পাস করা হয় (আগের হটফিক্সের শিক্ষা অনুসরণ করে)

## [Hotfix] — recorded_by NOT NULL এরর (স্টক-সমন্বয়, সরবরাহকারী-পেমেন্ট)
### Fixed
- **বাগ:** Phase06-এর "স্টক সমন্বয়" ফর্ম ও Phase07-এর "সরবরাহকারী-পেমেন্ট" ফর্ম থেকে সরাসরি `.insert()` কলে `recorded_by` ফিল্ড পাঠানো হচ্ছিল না, কিন্তু কলামটা NOT NULL — ফলে "সংরক্ষণ করা যায়নি" এরর হচ্ছিল (ব্যবহারকারীর রিপোর্ট করা লাইভ-টেস্টে ধরা পড়ে)
- **সমাধান (দুই স্তরে):**
  1. `supabase/fix_recorded_by_defaults.sql` — **নতুন SQL migration**, recorded_by-যুক্ত সব টেবিলে `DEFAULT auth.uid()` বসানো হলো, যাতে ভবিষ্যতে কোনো ইনসার্ট এই ফিল্ড বাদ দিলেও স্বয়ংক্রিয়ভাবে ঠিক থাকে
  2. `recordStockAdjustment()` ও `recordSupplierPayment()` ফাংশন সিগনেচার আপডেট — এখন স্পষ্টভাবে `recordedBy` প্যারামিটার নেয়, কলিং-পেজ থেকে `profile.id` পাঠানো হয়

### ⚠️ Migration Required
Supabase SQL Editor-এ `supabase/fix_recorded_by_defaults.sql` রান করুন (schema.sql-এর পরে যেকোনো সময়)।

## [Phase 08] — POS + Sales
### Added
- `supabase/phase08_functions.sql` — **নতুন SQL migration**, atomic RPC `create_sale_with_items()`: sale + sale_items (N লাইন) + stock_transactions (N sale_out এন্ট্রি) একটাই ট্রানজেকশনে; paid_amount সার্ভার-সাইডে পেমেন্ট-ধরন থেকে নির্ধারিত হয় (ফ্রন্টএন্ড-ইনপুট থেকে নয়) — Phase01 §৬.৩ নীতি হুবহু বলবৎ
- **POS পাতা** (`/pos`) — সৈনিক+পণ্য টাইপ-এহেড সার্চ, কার্ট, স্টিকি-টোটাল, নগদ/বাকি/আংশিক টগল, ডিসকাউন্ট (শুধু canteen_admin), ঋণাত্মক-স্টক override, কনফার্মেশন-স্ক্রিন
- বিক্রয়-রসিদ পাতা (`/sales/:id`), সাম্প্রতিক বিক্রয়-তালিকা (`/sales`)
- `src/lib/sales.ts` — POS/বিক্রয় ডেটা-অ্যাক্সেস
- নেভে "POS" ট্যাব যোগ (প্রথম দিকে, দৈনন্দিন সবচেয়ে ব্যবহৃত)

### Verified
- `tsc -b` ও `npm run build` — দুটোই ক্লিন পাস

### ⚠️ Migration Required
Supabase SQL Editor-এ `supabase/phase08_functions.sql` রান করতে হবে (schema.sql, rls_policies.sql, phase07_functions.sql-এর পরে)।

### Fixed during development
- RPC-এর খসড়া সংস্করণে at-sale পরিশোধিত অংশ ভুলবশত `payments` টেবিলেও ইনসার্ট করা হচ্ছিল, যেটা `sales.paid_amount`-এর সাথে ডাবল-কাউন্ট হয়ে `soldier_ledger`-এর outstanding ভুল দেখাতো (Phase02 VIEW সূত্র: total − paid_at_sale − collected)। রিভিউয়ে ধরা পড়ে সরিয়ে ফেলা হয়েছে — `payments` টেবিল শুধু Phase09-এর *পরবর্তী* বকেয়া-আদায়ের জন্য ব্যবহৃত হবে।

### Notes
- sale_items-এও audit trigger এই ফাইলে যোগ করা হয়েছে
- Approve (ডিসকাউন্ট) POS-এ UI-স্তরেই canteen_admin-এ সীমিত, এবং RPC-ও discount>0 হলে discount_approved_by বাধ্যতামূলক করে (ডাবল-লেয়ার সুরক্ষা)
- ঋণাত্মক-স্টক override UI-তেও শুধু canteen_admin দেখে — Sales Operator override করতে পারে না (Phase01 §৬.১ নীতি: "অনুমোদিত ইউজার")

## [Phase 07] — Purchase + Supplier
### Added
- `supabase/phase07_functions.sql` — **নতুন SQL migration**, atomic RPC `create_purchase_with_items()`: purchase + purchase_items (N লাইন) + stock_transactions (N purchase_in এন্ট্রি) একটাই ডাটাবেস-ট্রানজেকশনে — Phase01/02-এর ACID নীতি অনুযায়ী, মাঝপথে ব্যর্থ হলে কোনো আংশিক-ডেটা থাকবে না
- ক্রয়-তালিকা (`/purchases`), মাল্টি-লাইন ক্রয়-এন্ট্রি ফর্ম (`/purchases/new` — পণ্য+পরিমাণ+একক-মূল্য একাধিক লাইন, স্বয়ংক্রিয় মোট), ক্রয়-বিস্তারিত পাতা
- সরবরাহকারী-তালিকা (`/suppliers`, `supplier_payable` VIEW থেকে লাইভ বকেয়া), সরবরাহকারী-বিস্তারিত পাতা (ক্রয়-ইতিহাস + পেমেন্ট-ইতিহাস + পেমেন্ট-এন্ট্রি ফর্ম)
- `src/lib/purchases.ts` — ক্রয়/সরবরাহকারী/সরবরাহকারী-পেমেন্ট ডেটা-অ্যাক্সেস
- নেভে "ক্রয়" ট্যাব যোগ

### Verified
- `tsc -b` ও `npm run build` — দুটোই ক্লিন পাস

### ⚠️ Migration Required
এই ফেজে ব্যবহারের আগে Supabase SQL Editor-এ `supabase/phase07_functions.sql` রান করতে হবে (schema.sql ও rls_policies.sql-এর পরে) — নাহলে ক্রয়-এন্ট্রি ফর্ম "function does not exist" এরর দেবে।

### Notes
- purchase_items-এ audit trigger এই ফাইলেই যোগ করা হয়েছে (Phase02-এ বাদ পড়েছিল)
- RPC ফাংশন SECURITY INVOKER (ডিফল্ট) — কলকারীর RLS-ই প্রযোজ্য, কোনো পারমিশন-বাইপাস নেই

## [Phase 06] — Product + Inventory
### Added
- পণ্য তালিকা (`/inventory`) — নাম/SKU সার্চ, ক্যাটাগরি-ফিল্টার, লো-স্টক ফিল্টার+অ্যালার্ট, বর্তমান-স্টক কলাম (`current_stock` VIEW থেকে লাইভ)
- পণ্য তৈরি/সম্পাদনা ফর্ম (`/inventory/new`, `/inventory/:id/edit`) — শুধু canteen_admin, ক্যাটাগরি/সরবরাহকারী ইনলাইন কুইক-অ্যাড সহ
- পণ্য-বিস্তারিত পাতা (`/inventory/:id`) — বর্তমান স্টক/ক্রয়-মূল্য/বিক্রয়-মূল্য কার্ড, স্টক-হিস্ট্রি টাইমলাইন
- স্টক-সমন্বয় ফর্ম (adjustment/damage/expired) — override-চেকবক্স সহ, ঋণাত্মক-স্টক trigger-এরর UI-তে বাংলায় দেখানো হয়
- `src/lib/inventory.ts` — পণ্য/ক্যাটাগরি/সরবরাহকারী/স্টক-হিস্ট্রি ডেটা-অ্যাক্সেস ফাংশন
- AppLayout নেভে "ইনভেন্টরি" ট্যাব যোগ

### Verified
- `tsc -b` ও `npm run build` — দুটোই ক্লিন পাস

### Notes
- current_stock কখনো সরাসরি এডিট হয় না — শুধু stock_transactions এন্ট্রির মাধ্যমে (Phase02 নীতি)
- Phase02 trigger (`prevent_negative_stock`) স্বয়ংক্রিয়ভাবে ঋণাত্মক-স্টক আটকায়; override UI-তে স্পষ্টভাবে চিহ্নিত ও অডিট-লগড
- purchase_in/sale_out টাইপের stock_transactions এই ফেজে UI থেকে তৈরি হয় না — সেগুলো যথাক্রমে Phase07 (Purchase) ও Phase08 (POS)-এ স্বয়ংক্রিয়ভাবে তৈরি হবে

## [Phase 05] — Soldier Management
### Added
- `AppLayout` — শেয়ার্ড মাস্টহেড + ডেস্কটপ-নেভ + মোবাইল বটম-ট্যাব-বার (Phase03 IA অনুযায়ী)
- সৈনিক তালিকা (`/soldiers`) — নাম/সার্ভিস-নম্বর সার্চ, স্ট্যাটাস-ব্যাজ (রোল-নির্বিশেষে সবাই দেখতে পারে)
- সৈনিক তৈরি/সম্পাদনা ফর্ম (`/soldiers/new`, `/soldiers/:id/edit`) — শুধু canteen_admin, কোম্পানি/প্লাটুন ইনলাইন কুইক-অ্যাড সহ
- সৈনিক-লেজার পাতা (`/soldiers/:id`) — মোট ক্রয়/পরিশোধিত/বকেয়া (Phase02 `soldier_ledger` VIEW থেকে লাইভ) + লেনদেন-টাইমলাইন (sales+payments মিশ্রিত)
- `src/lib/soldiers.ts` — সব সৈনিক/কোম্পানি/প্লাটুন/লেজার ডেটা-অ্যাক্সেস ফাংশন

### Verified
- `tsc -b` — কোনো টাইপ-এরর নেই
- `npm run build` — সফল (একটা বেনিন বান্ডল-সাইজ ওয়ার্নিং, ফিচার বাড়ার সাথে Phase13+ এ code-splitting বিবেচনা করা হবে)

### Notes
- soldiers/companies/platoons মাস্টার-ডেটা (লেনদেন না) — তাই এডিট অনুমোদিত, Phase02 RLS-এ যেমন সংজ্ঞায়িত
- `soldier_ledger` কখনো ম্যানুয়ালি এডিট হয় না — সবসময় VIEW থেকে লাইভ-গণনা

## [Phase 04] — Authentication + RBAC
### Added
- Vite + React + TypeScript + Tailwind v4 প্রজেক্ট-স্ক্যাফোল্ড
- Supabase ক্লায়েন্ট (env-var চালিত, হার্ডকোডেড সিক্রেট নেই)
- `AuthContext` — সেশন ম্যানেজমেন্ট, `profiles` টেবিল থেকে রোল লোড, disabled-অ্যাকাউন্ট ব্লক
- `ProtectedRoute` — রোল-অ্যাওয়্যার রাউট-গার্ড (UX-স্তর; প্রকৃত সীমারেখা RLS)
- Login পাতা — Phase03 ডিজাইন-টোকেন + অফিসিয়াল Charging Nine ক্রেস্ট প্রয়োগ করা
- Dashboard/Unauthorized প্লেসহোল্ডার পাতা
- `supabase/rls_policies.sql` — সব ১৯+ টেবিলের জন্য সম্পূর্ণ RLS পলিসি (Phase02-এর ওপেন-ইস্যু সমাধান)
- `.env.example`, `PROJECT_STATUS.md`, `CHANGELOG.md`

### Verified
- `tsc -b` — কোনো টাইপ-এরর নেই
- `npm run build` — সফল, কোনো ওয়ার্নিং নেই

### Security
- কোনো হার্ডকোডেড সিক্রেট নেই (Phase01 §১০ নীতি)
- ফ্রন্টএন্ড রাউট-গার্ড শুধু UX; প্রকৃত সীমারেখা Supabase RLS
- sales/payments/stock_transactions/purchases-এ UPDATE/DELETE সম্পূর্ণ ব্লকড (immutable-transaction নীতি)

## [Phase 03] — UI/UX Design System (রিভিশন ২)
- অফিসিয়াল Charging Nine ক্রেস্ট ইন্টিগ্রেশন, রঙ-স্যাম্পলিং, ব্র্যান্ড-ব্যবহার-নিয়ম
- ব্র্যান্ড-রঙ/danger-রঙ সংঘর্ষ সমাধান — navy নতুন প্রাইমারি-অ্যাকশন রঙ

## [Phase 02] — Architecture + Database + Accounting Model
- Supabase/PostgreSQL চূড়ান্ত (Firebase-তুলনার পর)
- সম্পূর্ণ ERD/স্কিমা, ডেরাইভড-ভ্যালু VIEW, ঋণাত্মক-স্টক প্রতিরোধ trigger, অডিট-লগ trigger
- পেমেন্ট-গেটওয়ে ওয়েবহুক আর্কিটেকচার

## [Phase 01] — Requirements & System Constitution (৩ রিভিশন)
- স্কোপ, ৩-রোল পারমিশন-ম্যাট্রিক্স, সব ওয়ার্কফ্লো, POLICY INPUT সমাধান

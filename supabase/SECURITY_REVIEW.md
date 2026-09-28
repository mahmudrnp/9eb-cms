# SECURITY REVIEW — 9 EB CMS (Phase 14)

Phase01 §১০-এর নিরাপত্তা-প্রয়োজনীয়তা যাচাই + Phase02-১৩ পর্যন্ত জমে-থাকা সিকিউরিটি-পর্যালোচনা। এই ডকুমেন্ট কোড না — একটা চেকলিস্ট + পাওয়া-যাওয়া গ্যাপ ও তাদের সমাধান।

## ১. Authentication + Session

| আইটেম | অবস্থা |
|---|---|
| Supabase Auth (ইমেইল+পাসওয়ার্ড) | ✅ Phase04 থেকে বলবৎ |
| সেশন-পার্সিস্টেন্স + অটো-রিফ্রেশ | ✅ `supabaseClient.ts` |
| Disabled-অ্যাকাউন্ট ব্লক | ✅ `AuthContext.loadProfile()` — status='disabled' হলে সাথে সাথে সাইন-আউট |
| লগইন/লগআউট/ব্যর্থ-চেষ্টা অডিট | ✅ **Phase14** — `login_events` টেবিল, `/audit/logins` পাতা |
| পাসওয়ার্ড-নীতি (দৈর্ঘ্য/জটিলতা) | 🔶 Supabase Auth-এর ডিফল্ট নিয়ম প্রযোজ্য — ইউনিট-নির্দিষ্ট কড়া নীতি (ন্যূনতম দৈর্ঘ্য, মেয়াদ-উত্তীর্ণতা) দরকার হলে Supabase Dashboard → Auth → Policies-এ কনফিগার করতে হবে (**POLICY INPUT REQUIRED**) |
| পাবলিক সাইন-আপ | ⚠️ **সুপারিশ:** Supabase Dashboard → Auth → Providers-এ "Allow new users to sign up" বন্ধ রাখুন — এটা একটা invite-only স্টাফ-সিস্টেম, canteen_admin-ই `profiles` টেবিলে ম্যানুয়ালি ইউজার তৈরি করবে (Phase01 §৪ "User Management") |
| MFA/2FA | ✅ **Phase14b-এ সমাধান** — TOTP (Google Authenticator/Authy) স্ব-সেবা এনরোলমেন্ট `/settings/security`-এ, সব রোলের জন্য; পাসওয়ার্ড-সাইন-ইনের পরেও aal2-challenge পাস না-করা পর্যন্ত পুরো অ্যাপ ব্লকড |

## ২. Authorization (RBAC)

| আইটেম | অবস্থা |
|---|---|
| ডেটাবেস-লেভেল RLS (সব ১৯+২টা টেবিলে) | ✅ Phase04 `rls_policies.sql` + Phase14 `login_events` |
| ফ্রন্টএন্ড রাউট-গার্ড | ✅ `ProtectedRoute` — শুধু UX, RLS-ই আসল সীমারেখা (কোডে স্পষ্ট মন্তব্য আছে) |
| Immutable transactions (sales/purchases/payments/stock_transactions) | ✅ UPDATE/DELETE সব RLS-এ `false` |
| ফাইনালাইজড মাস write-protection | 🔶 Phase11-এ নোট করা হয়েছিল: লেনদেন-টেবিল এমনিতেই সবসময় ইমিউটেবল, তাই আলাদা "মাস-লক" চেক নেই — গ্রহণযোগ্য সরলীকরণ যতক্ষণ না ভবিষ্যতে সময়-ভিত্তিক নতুন-এন্ট্রি ব্লকিং দরকার হয় |
| **audit_logs SELECT-এ অতিরিক্ত-উন্মুক্ত ছিল** | ✅ **Phase14-এ সংশোধিত** — আগে `USING (true)` (সবাই দেখতে পারত, যাতে সব টেবিলের পূর্ণ আর্থিক-রো JSONB-তে ছিল); এখন `canteen_admin`-এ সীমিত (least-privilege) |

## ৩. Input Validation

| আইটেম | অবস্থা |
|---|---|
| DB-লেভেল CHECK constraints (amount>0, quantity ইত্যাদি) | ✅ schema.sql-এ ব্যাপকভাবে ব্যবহৃত |
| ঋণাত্মক-স্টক প্রতিরোধ trigger | ✅ `prevent_negative_stock()` |
| ফ্রন্টএন্ড ফর্ম-ভ্যালিডেশন (required fields, সংখ্যা-রেঞ্জ) | ✅ প্রতিটা ফর্মে HTML5 `required`/`min` + সাবমিট-আগে চেক |
| SQL Injection | ✅ ঝুঁকি নেই — Supabase JS ক্লায়েন্ট সবসময় parameterized query ব্যবহার করে, কোনো raw string-concatenated SQL নেই |
| XSS | ✅ React-এর ডিফল্ট escaping যথেষ্ট — কোথাও `dangerouslySetInnerHTML` ব্যবহৃত হয়নি |

## ৪. Audit Logging (Phase14-এর মূল সংযোজন)

| আইটেম | অবস্থা |
|---|---|
| DB-টেবিল write অডিট (INSERT/UPDATE/DELETE) | ✅ Phase02 থেকেই — `log_audit()` trigger, ৭টা টেবিলে সংযুক্ত |
| Login/Logout/ব্যর্থ-লগইন অডিট | ✅ **নতুন (Phase14)** — `login_events` |
| রিপোর্ট-এক্সপোর্ট অডিট | ✅ **নতুন (Phase14)** — `audit_logs` টেবিলেই `action='export'` হিসেবে, ExportBar থেকে স্বয়ংক্রিয় |
| অডিট-লগ দেখার UI | ✅ **নতুন (Phase14)** — `/audit` (কার্যক্রম), `/audit/logins` (লগইন-ইতিহাস), শুধু canteen_admin |
| অডিট-লগ tamper-প্রুফ | ✅ `audit_no_update`/`audit_no_delete` এবং `login_events_no_update`/`no_delete` — RLS-এ UPDATE/DELETE সম্পূর্ণ ব্লকড, এমনকি canteen_admin-ও না |

## ৫. Secrets & Configuration

| আইটেম | অবস্থা |
|---|---|
| হার্ডকোডেড সিক্রেট | ✅ নেই — `supabaseClient.ts` env-var ছাড়া থ্রো করে |
| `.env` গিট-ইগনোরড | ✅ (`.env.example` শুধু টেমপ্লেট) |
| Anon key ক্লায়েন্ট-সাইডে এক্সপোজড | ✅ **এটা প্রত্যাশিত/স্ট্যান্ডার্ড** — Supabase anon key পাবলিক-সেফ, প্রকৃত সুরক্ষা RLS-এ; service_role key কখনো ফ্রন্টএন্ডে ব্যবহৃত হয়নি |

## ৬. জানা-সীমাবদ্ধতা / গ্রহণযোগ্য-ঝুঁকি (Accepted Risks)

এই আইটেমগুলো সচেতনভাবে সরল রাখা হয়েছে, ভবিষ্যতে প্রয়োজনমতো শক্ত করা যাবে:

1. **`login_events` INSERT-এ সীমিত anon-অ্যাক্সেস (ব্যর্থ-লগইন লগ করতে):** কোনো anon ক্লায়েন্ট `event_type='login_failed', user_id=NULL` শেপের রো বারবার ইনসার্ট করে টেবিল-ফ্লাড করতে পারে তাত্ত্বিকভাবে (যদিও তারা কখনো এই ডেটা SELECT করতে পারবে না, শুধু canteen_admin পারে)। ইউনিট-ইন্ট্রানেট অ্যাপের জন্য গ্রহণযোগ্য; পাবলিক-ইন্টারনেট-এক্সপোজড হলে rate-limiting (Edge Function/Cloudflare) যোগ করা উচিত।
2. **স্টক-মূল্যায়ন সবসময় বর্তমান ক্রয়-মূল্যে** (Phase11-এ নোট করা, FIFO/weighted-average না) — নিরাপত্তা-ইস্যু না, কিন্তু আর্থিক-নির্ভুলতার সীমাবদ্ধতা হিসেবে এখানেও উল্লেখযোগ্য।
3. **MFA নেই** — উপরে §১-এ উল্লেখিত।
4. **অ্যাকাউন্ট-লকআউট নেই** (N-বার ব্যর্থ লগইনের পর সাময়িক ব্লক) — ✅ **Phase14b-এ সমাধান** (`check_login_lockout` RPC — ১৫ মিনিটে ৫-বার ব্যর্থের পর ১৫ মিনিট ব্লক, থ্রেশহোল্ড ডিফল্ট-প্রস্তাবিত, প্রয়োজনে পরিবর্তনযোগ্য)

## ৭. সুপারিশ — Phase15/16-এর আগে

- [ ] Supabase Dashboard-এ পাবলিক সাইন-আপ বন্ধ করা (§১)
- [ ] প্রোডাকশনে যাওয়ার আগে সব টেস্ট-ইউজার/ডামি-ডেটা মুছে ফেলা
- [ ] PITR/ব্যাকআপ-প্ল্যান চূড়ান্ত করা (`BACKUP_RECOVERY.md` দেখুন)
- [ ] canteen_admin-দের জন্য শক্তিশালী, ইউনিক পাসওয়ার্ড ব্যবহারের নির্দেশনা
- [ ] `/audit/logins`-এ মাসে অন্তত একবার চোখ বুলানোর অভ্যাস (কোনো অস্বাভাবিক ব্যর্থ-লগইন প্যাটার্ন আছে কিনা)

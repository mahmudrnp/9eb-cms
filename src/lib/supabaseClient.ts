import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // এনভায়রনমেন্ট-ভ্যারিয়েবল ছাড়া অ্যাপ চালানো যাবে না — কোনো হার্ডকোডেড সিক্রেট নয় (Phase01 §১০ নীতি)
  throw new Error(
    'Supabase কনফিগারেশন পাওয়া যায়নি — .env ফাইলে VITE_SUPABASE_URL ও VITE_SUPABASE_ANON_KEY সেট করুন (.env.example দেখুন)।'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

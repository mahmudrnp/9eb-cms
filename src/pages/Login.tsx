import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import crest from '../assets/charging-nine-crest.png';

export function LoginPage() {
  const { user, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) setFormError(error);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        {/* Phase03 রিভিশন২ ব্র্যান্ড-নিয়ম: ক্রেস্ট এখানে বড় আকারে — লগইন-স্ক্রিনই একমাত্র হিরো-প্লেসমেন্ট */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={crest} alt="৯ ইস্ট বেঙ্গল রেজিমেন্ট — চার্জিং নাইন" className="mb-4 h-28 w-28" />
          <h1 className="text-xl font-semibold text-ink">৯ ইস্ট বেঙ্গল রেজিমেন্ট</h1>
          <p className="text-sm text-steel">ক্যান্টিন ব্যবস্থাপনা সিস্টেম</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-6 shadow-[var(--shadow-elevated)]"
        >
          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
              ইমেইল
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2.5 text-ink outline-none focus-visible:border-navy"
              placeholder="you@9eb.mil.bd"
            />
          </div>

          <div className="mb-5">
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
              পাসওয়ার্ড
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2.5 text-ink outline-none focus-visible:border-navy"
              placeholder="••••••••"
            />
          </div>

          {formError && (
            <p role="alert" className="mb-4 rounded-[var(--radius-control)] bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-[var(--radius-control)] bg-navy px-4 py-2.5 font-medium text-white transition-colors hover:bg-[var(--color-navy-hover)] disabled:opacity-60"
          >
            {submitting ? 'লগইন হচ্ছে…' : 'লগইন করুন'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-steel">
          অ্যাকাউন্ট-সংক্রান্ত সমস্যায় আপনার Canteen Admin-এর সাথে যোগাযোগ করুন।
        </p>
      </div>
    </div>
  );
}

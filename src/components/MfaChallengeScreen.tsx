import { useState, type FormEvent } from 'react';
import crest from '../assets/charging-nine-crest.png';

interface MfaChallengeScreenProps {
  onVerify: (code: string) => Promise<{ error: string | null }>;
  onCancel: () => Promise<void>;
}

// Phase14b: পাসওয়ার্ড-সাইন-ইনের পরে TOTP-এনরোলড ইউজারকে এখানে আটকানো হয় —
// পুরো অ্যাপের বদলে এই স্ক্রিন রেন্ডার হয় (AuthContext দেখুন), তাই কোনো
// প্রোটেক্টেড-রুটে ভুলবশত AAL1-এই ঢুকে পড়ার সুযোগ নেই।
export function MfaChallengeScreen({ onVerify, onCancel }: MfaChallengeScreenProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const { error } = await onVerify(code.trim());
    setSubmitting(false);
    if (error) setFormError(error);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={crest} alt="৯ ইস্ট বেঙ্গল রেজিমেন্ট — চার্জিং নাইন" className="mb-4 h-20 w-20" />
          <h1 className="text-lg font-semibold text-ink">দুই-স্তর যাচাইকরণ</h1>
          <p className="text-sm text-steel">আপনার Authenticator অ্যাপ থেকে ৬-সংখ্যার কোড দিন</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-6 shadow-[var(--shadow-elevated)]">
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="mb-4 w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2.5 text-center font-data text-2xl tracking-[0.5em] text-ink outline-none focus-visible:border-navy"
          />

          {formError && (
            <p role="alert" className="mb-4 rounded-[var(--radius-control)] bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full rounded-[var(--radius-control)] bg-navy px-4 py-2.5 font-medium text-white transition-colors hover:bg-[var(--color-navy-hover)] disabled:opacity-60"
          >
            {submitting ? 'যাচাই হচ্ছে…' : 'যাচাই করুন'}
          </button>
        </form>

        <button onClick={() => void onCancel()} className="mt-6 w-full text-center text-xs text-steel underline">
          এটা আমি না? সাইন-আউট করুন
        </button>
      </div>
    </div>
  );
}

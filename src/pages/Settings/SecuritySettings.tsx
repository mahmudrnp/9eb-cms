import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { supabase } from '../../lib/supabaseClient';

interface EnrollState {
  factorId: string;
  qrCode: string; // data:image/svg+xml;... থেকে সরাসরি <img>-এ দেখানো যায়
  secret: string;
}

export function SecuritySettingsPage() {
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  async function loadFactors() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp?.find((f) => f.status === 'verified');
    setVerifiedFactorId(totp?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadFactors();
  }, []);

  async function startEnroll() {
    setMessage(null);
    setBusy(true);
    // আগে-থেকে-থাকা যেকোনো unverified factor পরিষ্কার করা হয় (একাধিক আধা-এনরোলড
    // factor জমে গেলে enroll() মাঝে মাঝে ব্যর্থ হয়)
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.totp ?? []) {
      if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setBusy(false);
    if (error || !data) {
      setMessage({ type: 'error', text: '2FA সেটআপ শুরু করা যায়নি — আবার চেষ্টা করুন।' });
      return;
    }
    setEnroll({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll() {
    if (!enroll) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.factorId, code: code.trim() });
    setBusy(false);
    if (error) {
      setMessage({ type: 'error', text: 'কোড সঠিক নয় — Authenticator অ্যাপের বর্তমান কোডটা আবার দিন।' });
      return;
    }
    setEnroll(null);
    setCode('');
    setMessage({ type: 'success', text: '２FA সফলভাবে সক্রিয় হয়েছে — পরবর্তী লগইন থেকে কোড চাওয়া হবে।' });
    await loadFactors();
  }

  async function disable2FA() {
    if (!verifiedFactorId) return;
    if (!confirm('２FA নিষ্ক্রিয় করলে অ্যাকাউন্টের নিরাপত্তা কমে যাবে। নিশ্চিত?')) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId });
    setBusy(false);
    if (error) {
      setMessage({ type: 'error', text: 'নিষ্ক্রিয় করা যায়নি — আবার চেষ্টা করুন।' });
      return;
    }
    setMessage({ type: 'success', text: '２FA নিষ্ক্রিয় করা হয়েছে।' });
    await loadFactors();
  }

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">দুই-স্তর যাচাইকরণ (2FA)</h1>
      <p className="mb-5 text-sm text-steel">
        পাসওয়ার্ডের পাশাপাশি Google Authenticator/Authy-এর মতো একটা অ্যাপ থেকে কোড দিয়ে লগইন-নিরাপত্তা বাড়ান — বিশেষভাবে
        সুপারিশকৃত Canteen Admin-দের জন্য, যেহেতু আর্থিক-তথ্যে পূর্ণ-এক্সেস আছে।
      </p>

      {message && (
        <p className={`mb-4 rounded-[var(--radius-control)] px-3 py-2 text-sm ${message.type === 'error' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
          {message.text}
        </p>
      )}

      {loading && <p className="text-sm text-steel">লোড হচ্ছে…</p>}

      {!loading && !enroll && verifiedFactorId && (
        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-success">２FA সক্রিয় আছে ✓</p>
          <button
            onClick={disable2FA}
            disabled={busy}
            className="rounded-[var(--radius-control)] border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
          >
            নিষ্ক্রিয় করুন
          </button>
        </div>
      )}

      {!loading && !enroll && !verifiedFactorId && (
        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-4">
          <p className="mb-3 text-sm text-steel">２FA এখনো সক্রিয় নয়।</p>
          <button
            onClick={startEnroll}
            disabled={busy}
            className="rounded-[var(--radius-control)] bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-hover disabled:opacity-50"
          >
            ２FA সক্রিয় করুন
          </button>
        </div>
      )}

      {enroll && (
        <div className="rounded-[var(--radius-card)] border border-steel/20 bg-white p-4">
          <p className="mb-3 text-sm text-ink">
            ১. Google Authenticator/Authy অ্যাপ দিয়ে নিচের QR কোড স্ক্যান করুন (অথবা সিক্রেট-কোড ম্যানুয়ালি লিখুন)
          </p>
          <img src={enroll.qrCode} alt="TOTP QR code" className="mx-auto mb-3 h-44 w-44" />
          <p className="mb-4 break-all rounded-[var(--radius-control)] bg-paper px-3 py-2 text-center font-data text-xs text-steel">
            {enroll.secret}
          </p>
          <p className="mb-2 text-sm text-ink">২. অ্যাপে দেখানো ৬-সংখ্যার কোড এখানে দিন</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="mb-3 w-full rounded-[var(--radius-control)] border border-steel/30 px-3 py-2.5 text-center font-data text-xl tracking-[0.4em] text-ink outline-none focus-visible:border-navy"
          />
          <div className="flex gap-2">
            <button
              onClick={confirmEnroll}
              disabled={busy || code.length !== 6}
              className="flex-1 rounded-[var(--radius-control)] bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-hover disabled:opacity-50"
            >
              {busy ? 'যাচাই হচ্ছে…' : 'নিশ্চিত করুন ও সক্রিয় করুন'}
            </button>
            <button
              onClick={() => {
                setEnroll(null);
                setCode('');
              }}
              className="rounded-[var(--radius-control)] border border-steel/40 px-4 py-2.5 text-sm text-ink hover:bg-steel/10"
            >
              বাতিল
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

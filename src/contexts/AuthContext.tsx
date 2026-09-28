import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { logLoginEvent } from '../lib/audit';
import { MfaChallengeScreen } from '../components/MfaChallengeScreen';
import type { Profile } from '../types/database.types';

interface MfaChallengeState {
  factorId: string;
  challengeId: string;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  mfaPending: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  verifyMfaChallenge: (code: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeState | null>(null);

  async function loadProfile(userId: string) {
    // profiles.role-ই একমাত্র RBAC-এর উৎস — কখনো ক্লায়েন্ট-সাইড অনুমান নয়
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, role, status, created_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      setError('প্রোফাইল লোড করা যায়নি — অ্যাডমিনের সাথে যোগাযোগ করুন।');
      setProfile(null);
      return;
    }
    if (data.status === 'disabled') {
      setError('এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে — Canteen Admin-এর সাথে যোগাযোগ করুন।');
      await supabase.auth.signOut();
      setProfile(null);
      return;
    }
    setProfile(data as Profile);
  }

  // Phase14b: TOTP MFA — canteen_admin (বা যেকোনো ইউজার যিনি নিজে ইচ্ছাকৃতভাবে
  // Settings→Security থেকে একটা verified factor enroll করেছেন) পাসওয়ার্ড-সাইন-ইনের
  // পরেও aal2-এ না ওঠা পর্যন্ত পুরো অ্যাপ ব্লকড থাকে (নিচে children-এর জায়গায়
  // চ্যালেঞ্জ-স্ক্রিন রেন্ডার হয়)। কোনো factor enroll করা না থাকলে nextLevel
  // কখনো 'aal2' হয় না, তাই এই চেক তাদের জন্য কোনো প্রভাব ফেলে না।
  async function checkMfaAndMaybeChallenge() {
    const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError || !data) return;
    if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totp = factorsData?.totp?.find((f) => f.status === 'verified');
      if (!totp) return;
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (challengeError || !challengeData) return;
      setMfaChallenge({ factorId: totp.id, challengeId: challengeData.id });
    } else {
      setMfaChallenge(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([loadProfile(session.user.id), checkMfaAndMaybeChallenge()]).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
        checkMfaAndMaybeChallenge();
      } else {
        setProfile(null);
        setMfaChallenge(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    setError(null);

    // Phase14b: অ্যাকাউন্ট-লকআউট চেক — Supabase Auth-কে কল করার আগেই।
    // সাম্প্রতিক ব্যর্থ-লগইন গণনা করে RPC (SECURITY DEFINER) শুধু বুলিয়ান+কাউন্টডাউন
    // ফেরত দেয়, কোনো raw log এক্সপোজ করে না।
    const { data: lockoutData } = await supabase.rpc('check_login_lockout', { p_email: email });
    const lockout = Array.isArray(lockoutData) ? lockoutData[0] : lockoutData;
    if (lockout?.locked) {
      const minutes = Math.ceil((lockout.seconds_remaining ?? 0) / 60);
      const message = `অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে — নিরাপত্তার জন্য এই অ্যাকাউন্ট প্রায় ${minutes} মিনিটের জন্য সাময়িকভাবে ব্লকড। একটু পরে আবার চেষ্টা করুন।`;
      setError(message);
      await logLoginEvent({ eventType: 'login_blocked', emailAttempted: email });
      return { error: message };
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      const message = 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।';
      setError(message);
      // Phase14: ব্যর্থ-লগইন-চেষ্টা অডিট-লগে রাখা হয় (পাসওয়ার্ড কখনো না) —
      // অ্যাকাউন্টের বিরুদ্ধে সন্দেহজনক-প্যাটার্ন পরে শনাক্ত করা যাবে
      await logLoginEvent({ eventType: 'login_failed', emailAttempted: email });
      return { error: message };
    }
    if (data.user) {
      await logLoginEvent({ eventType: 'login_success', userId: data.user.id });
    }
    return { error: null };
  }

  async function signOut() {
    // সাইন-আউটের আগে লগ করতে হবে — তখনো authenticated, তাই RLS-চেক পাস করবে
    if (user) {
      await logLoginEvent({ eventType: 'logout', userId: user.id });
    }
    await supabase.auth.signOut();
    setProfile(null);
    setMfaChallenge(null);
  }

  async function verifyMfaChallenge(code: string) {
    if (!mfaChallenge) return { error: 'কোনো চ্যালেঞ্জ পাওয়া যায়নি — আবার লগইন করুন।' };
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaChallenge.factorId,
      challengeId: mfaChallenge.challengeId,
      code,
    });
    if (verifyError) {
      return { error: 'কোড সঠিক নয় বা মেয়াদ শেষ — আবার চেষ্টা করুন।' };
    }
    setMfaChallenge(null);
    return { error: null };
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, error, mfaPending: mfaChallenge !== null, signIn, signOut, verifyMfaChallenge }}
    >
      {mfaChallenge ? <MfaChallengeScreen onVerify={verifyMfaChallenge} onCancel={signOut} /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth অবশ্যই AuthProvider-এর ভেতরে ব্যবহার করতে হবে।');
  return ctx;
}

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/database.types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[]; // না দিলে — শুধু লগইন-থাকা-বাধ্যতামূলক, কোনো রোল-সীমাবদ্ধতা নয়
}

/**
 * ⚠️ এটা শুধু UX — প্রকৃত নিরাপত্তা-সীমারেখা সবসময় Supabase RLS পলিসিতে
 * (Phase02 §RLS + এই ফেজের rls_policies.sql)। ফ্রন্টএন্ড রাউট-গার্ড এড়িয়ে গেলেও
 * DB-লেভেলে অননুমোদিত write ব্লকড থাকবে — Phase01 §১০ নীতি অনুযায়ী।
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink">
        লোড হচ্ছে…
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

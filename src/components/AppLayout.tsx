import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import crest from '../assets/charging-nine-crest.png';

const roleLabel: Record<string, string> = {
  canteen_admin: 'Canteen Admin',
  sales_operator: 'Sales Operator',
  viewer: 'Viewer',
};

const navItems = [
  { to: '/', label: 'ড্যাশবোর্ড' },
  { to: '/pos', label: 'POS' },
  { to: '/soldiers', label: 'প্রোফাইল' },
  { to: '/inventory', label: 'পণ্য' },
  { to: '/purchases', label: 'ক্রয়' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-paper pb-16 md:pb-0">
      {/* Phase03 রিভিশন২ মাস্টহেড প্যাটার্ন */}
      <header className="sticky top-0 z-10 border-b border-steel/20 bg-white">
        <div className="h-0.5 w-full bg-navy" />
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <img src={crest} alt="৯ ইস্ট বেঙ্গল রেজিমেন্ট" className="h-9 w-9" />
            <div>
              <p className="text-sm font-semibold leading-tight text-ink">৯ ইস্ট বেঙ্গল রেজিমেন্ট</p>
              <p className="text-xs leading-tight text-steel">ক্যান্টিন ব্যবস্থাপনা</p>
            </div>
          </div>

          {/* ডেস্কটপ নেভ — মোবাইলে নিচের বটম-ট্যাব-বার ব্যবহৃত হয় (Phase03 §২) */}
          <nav className="hidden items-center gap-4 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`text-sm font-medium ${
                  location.pathname === item.to ? 'text-navy' : 'text-steel hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <Link to="/settings/security" className="hidden text-steel hover:text-ink sm:inline">
              {profile?.name} · {profile ? roleLabel[profile.role] : ''}
            </Link>
            <button onClick={signOut} className="font-medium text-navy underline">
              লগআউট
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

      {/* মোবাইল বটম-ট্যাব-বার (Phase03 §২ নীতি) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-steel/20 bg-white md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex-1 py-2.5 text-center text-xs font-medium ${
              location.pathname === item.to ? 'text-navy' : 'text-steel'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

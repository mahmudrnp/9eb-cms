import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';

interface ReportLink {
  to: string;
  label: string;
  hint: string;
}

export function ReportsHubPage() {
  const { profile } = useAuth();
  const canSeeFinancials = profile?.role === 'canteen_admin' || profile?.role === 'viewer';

  const inventoryReports: ReportLink[] = [
    { to: '/inventory', label: 'বর্তমান স্টক ও স্টক-ভ্যালুয়েশন', hint: 'সব পণ্য, বর্তমান পরিমাণ, লো-স্টক' },
    { to: '/reports/stock-movement', label: 'স্টক মুভমেন্ট', hint: 'সব স্টক-ইন/আউট/সমন্বয়/ক্ষতিগ্রস্ত/মেয়াদোত্তীর্ণ' },
    { to: '/inventory/expiry', label: 'মেয়াদ-উত্তীর্ণ সতর্কতা', hint: 'কোন ব্যাচের মেয়াদ কবে শেষ হচ্ছে' },
    { to: '/reports/product-performance', label: 'পণ্য-পারফরম্যান্স', hint: 'কোন পণ্য বেশি/কম বিক্রি হচ্ছে' },
  ];

  const salesReports: ReportLink[] = [
    { to: '/sales', label: 'বিক্রয় রিপোর্ট', hint: 'সাম্প্রতিক বিক্রয় — নগদ/বাকি/আংশিক, তারিখ অনুযায়ী' },
  ];

  const creditReports: ReportLink[] = [
    { to: '/credit', label: 'বকেয়া-তালিকা (Outstanding Balances)', hint: 'সব সৈনিকের বকেয়া, বেশি-থেকে-কম' },
  ];

  const financialReports: ReportLink[] = canSeeFinancials
    ? [
        { to: '/reports/profit-loss', label: 'লাভ-ক্ষতি (Profit & Loss)', hint: 'Sales Revenue, COGS, Gross Profit, Net Result' },
        { to: '/expenses', label: 'খরচ রিপোর্ট', hint: 'সব অপারেটিং খরচ' },
        { to: '/purchases', label: 'ক্রয় রিপোর্ট', hint: 'সব ক্রয়-এন্ট্রি, সরবরাহকারী-ভিত্তিক' },
      ]
    : [];

  const isAdmin = profile?.role === 'canteen_admin';
  const securityReports: ReportLink[] = isAdmin
    ? [
        { to: '/audit', label: 'অডিট লগ', hint: 'সব তৈরি/সম্পাদনা/মুছে-ফেলা/এক্সপোর্ট কার্যক্রম' },
        { to: '/audit/logins', label: 'লগইন ইতিহাস', hint: 'সফল/ব্যর্থ লগইন ও লগআউট ইভেন্ট' },
        { to: '/corrections', label: 'সংশোধনী-এন্ট্রি', hint: 'ভুল লেনদেনের correction-entry নথিভুক্তি' },
      ]
    : [];

  const adminTools: ReportLink[] = isAdmin
    ? [
        { to: '/inventory/labels', label: 'পণ্য QR লেবেল', hint: 'প্রিন্ট-করার-উপযোগী QR লেবেল — POS-স্ক্যানের জন্য' },
        { to: '/soldiers/import', label: 'সৈনিক বাল্ক-আমদানি', hint: 'CSV/Excel থেকে একসাথে অনেক সৈনিক যোগ' },
        { to: '/purchases/import', label: 'ক্রয় বাল্ক-আমদানি', hint: 'CSV/Excel থেকে একসাথে অনেক ক্রয়-এন্ট্রি' },
      ]
    : [];

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-ink">রিপোর্ট</h1>
      <p className="mb-6 text-sm text-steel">প্রতিটা রিপোর্ট-পাতায় CSV/Excel/PDF এক্সপোর্ট বাটন আছে</p>

      <ReportSection title="ইনভেন্টরি" links={inventoryReports} />
      <ReportSection title="বিক্রয়" links={salesReports} />
      <ReportSection title="ক্রেডিট" links={creditReports} />
      {financialReports.length > 0 && <ReportSection title="আর্থিক" links={financialReports} />}
      {securityReports.length > 0 && <ReportSection title="নিরাপত্তা ও অডিট" links={securityReports} />}
      {adminTools.length > 0 && <ReportSection title="অ্যাডমিন টুলস" links={adminTools} />}
      <ReportSection
        title="আপনার অ্যাকাউন্ট"
        links={[{ to: '/settings/security', label: 'দুই-স্তর যাচাইকরণ (2FA)', hint: 'আপনার লগইন আরও নিরাপদ করুন' }]}
      />
    </AppLayout>
  );
}

function ReportSection({ title, links }: { title: string; links: ReportLink[] }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-steel/20 bg-white">
        {links.map((l, idx) => (
          <Link
            key={l.to}
            to={l.to}
            className={`block px-3 py-2.5 text-sm hover:bg-paper ${idx !== links.length - 1 ? 'border-b border-steel/10' : ''}`}
          >
            <p className="text-navy underline">{l.label}</p>
            <p className="text-xs text-steel">{l.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

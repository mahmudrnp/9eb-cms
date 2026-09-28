import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-4 text-center">
      <h1 className="text-lg font-semibold text-ink">এই পাতায় প্রবেশাধিকার নেই</h1>
      <p className="max-w-sm text-sm text-steel">
        আপনার রোল এই ফিচারটি ব্যবহারের অনুমতি দেয় না। প্রয়োজন মনে করলে Canteen Admin-এর সাথে যোগাযোগ করুন।
      </p>
      <Link to="/" className="mt-2 text-sm font-medium text-navy underline">
        ড্যাশবোর্ডে ফিরে যান
      </Link>
    </div>
  );
}

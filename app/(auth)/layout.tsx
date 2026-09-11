import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="px-4 py-6 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold text-slate-900">
          <GraduationCap className="h-6 w-6 text-brand-600" aria-hidden />
          Student Connect
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

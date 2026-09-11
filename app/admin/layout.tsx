import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Flag, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import { AppNav } from '@/components/layout/app-nav';
import { getCurrentProfile } from '@/lib/queries/profile';

const TABS = [
  { href: '/admin', label: 'Overview', Icon: LayoutDashboard, superOnly: false },
  { href: '/admin/reports', label: 'Reports', Icon: Flag, superOnly: false },
  { href: '/admin/groups', label: 'Group requests', Icon: ShieldCheck, superOnly: false },
  { href: '/admin/users', label: 'Users', Icon: Users, superOnly: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  // Middleware already blocks students; this is the second line.
  if (profile.role === 'student') redirect('/dashboard');

  const isSuper = profile.role === 'super_admin';

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav profile={profile} />

      <div className="container-page py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ShieldCheck className="h-6 w-6 text-brand-600" aria-hidden />
            Admin
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isSuper
              ? 'You have full administrative access.'
              : 'Club admin access: moderation and the groups you run.'}
          </p>
        </div>

        <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
          {TABS.filter((t) => isSuper || !t.superOnly).map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}

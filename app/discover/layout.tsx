import { redirect } from 'next/navigation';
import { AppNav } from '@/components/layout/app-nav';
import { getCurrentProfile } from '@/lib/queries/profile';

export default async function DiscoverLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav profile={profile} />
      <main className="container-page py-8">{children}</main>
    </div>
  );
}

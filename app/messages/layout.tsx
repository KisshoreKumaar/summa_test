import { redirect } from 'next/navigation';
import { AppNav } from '@/components/layout/app-nav';
import { getCurrentProfile } from '@/lib/queries/profile';

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppNav profile={profile} />
      <div className="container-page flex-1 py-6">{children}</div>
    </div>
  );
}

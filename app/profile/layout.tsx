import { redirect } from 'next/navigation';
import { AppNav } from '@/components/layout/app-nav';
import { getCurrentProfile } from '@/lib/queries/profile';

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  // No profile row means the session is unusable — clear it rather than
  // bouncing to /login, which middleware would send straight back here.
  if (!profile) redirect('/auth/signout');

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav profile={profile} />
      <main className="container-page py-8">{children}</main>
    </div>
  );
}

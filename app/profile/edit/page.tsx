import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ProfileForm } from '@/components/profile/profile-form';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'Edit profile' };

export default async function EditProfilePage() {
  const profile = await getCurrentProfile();
  // No profile row means the session is unusable — clear it rather than
  // bouncing to /login, which middleware would send straight back here.
  if (!profile) redirect('/auth/signout');

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Edit profile</h1>
      <p className="mt-1 text-sm text-slate-600">
        Changes are visible to other students right away.
      </p>
      <div className="mt-6">
        <ProfileForm profile={profile} />
      </div>
    </div>
  );
}

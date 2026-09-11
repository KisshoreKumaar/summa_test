import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CreateGroupForm } from '@/components/groups/create-group-form';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'Create a group' };

export default async function NewGroupPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Create a group</h1>
      <p className="mt-1 text-sm text-slate-600">
        You will be its owner. Batch groups are created automatically and cannot be made here.
      </p>
      <div className="mt-6">
        <CreateGroupForm userId={profile.id} />
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MentorProfileForm } from '@/components/mentorship/mentor-profile-form';
import { AvailabilityManager } from '@/components/mentorship/availability-manager';
import { getMyMentorProfile, getMySlotsWithBookers } from '@/lib/queries/mentorship';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'Mentor settings' };

export default async function MentorSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const mentor = await getMyMentorProfile();
  const slots = mentor ? await getMySlotsWithBookers() : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {mentor ? 'Mentor settings' : 'Become a mentor'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {mentor
            ? 'Update what you can help with, and when you are free.'
            : 'Tell students what you can help with. You can pause or leave at any time.'}
        </p>
      </div>

      <MentorProfileForm mentor={mentor} />

      {mentor && <AvailabilityManager slots={slots} />}
    </div>
  );
}

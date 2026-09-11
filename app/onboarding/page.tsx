import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { GraduationCap } from 'lucide-react';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'Set up your profile' };

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();

  // No profile row means the session is unusable — clear it rather than
  // bouncing to /login, which middleware would send straight back here.
  if (!profile) redirect('/auth/signout');
  if (profile.onboarded_at) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container-page flex h-16 items-center gap-2">
          <GraduationCap className="h-6 w-6 text-brand-600" aria-hidden />
          <span className="font-semibold text-slate-900">Student Connect</span>
        </div>
      </header>

      <main className="container-page max-w-2xl py-8 sm:py-12">
        <OnboardingWizard profile={profile} />
      </main>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { completeOnboardingAction, type ProfileFormState } from '@/lib/actions/profile';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StepBasics } from '@/components/onboarding/step-basics';
import { StepTags } from '@/components/onboarding/step-tags';
import { StepLinks } from '@/components/onboarding/step-links';
import type { Profile, ProfileVisibility } from '@/lib/types/database';

const initialState: ProfileFormState = {};

const STEPS = [
  { id: 'basics', title: 'The basics', description: 'Who you are and what you study.' },
  { id: 'tags', title: 'Skills & interests', description: 'This is how peers will find you.' },
  { id: 'links', title: 'Links & privacy', description: 'Optional, but they help a lot.' },
] as const;

export interface OnboardingDraft {
  full_name: string;
  year: string;
  branch: string;
  bio: string;
  avatar_url: string | null;
  skills: string[];
  interests: string[];
  github_url: string;
  linkedin_url: string;
  portfolio_url: string;
  visibility: ProfileVisibility;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      <Check className="h-4 w-4" aria-hidden />
      Finish setup
    </Button>
  );
}

export function OnboardingWizard({ profile }: { profile: Profile }) {
  const [state, formAction] = useFormState(completeOnboardingAction, initialState);
  const [step, setStep] = useState(0);

  const [draft, setDraft] = useState<OnboardingDraft>({
    full_name: profile.full_name ?? '',
    year: profile.year ? String(profile.year) : '',
    branch: profile.branch ?? '',
    bio: profile.bio ?? '',
    avatar_url: profile.avatar_url,
    skills: profile.skills ?? [],
    interests: profile.interests ?? [],
    github_url: profile.github_url ?? '',
    linkedin_url: profile.linkedin_url ?? '',
    portfolio_url: profile.portfolio_url ?? '',
    visibility: profile.visibility,
  });

  function patch(next: Partial<OnboardingDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  const canAdvance = useMemo(() => {
    if (step === 0) return draft.full_name.trim().length >= 2 && draft.branch !== '';
    return true;
  }, [step, draft.full_name, draft.branch]);

  const isLastStep = step === STEPS.length - 1;
  const current = STEPS[step]!;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Set up your profile</h1>
          <span className="text-sm text-slate-500">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <Progress
          value={((step + 1) / STEPS.length) * 100}
          label={`Onboarding step ${step + 1} of ${STEPS.length}`}
        />
      </div>

      <form action={formAction}>
        {/*
          Every field is mirrored into hidden inputs so that values entered on
          earlier steps still reach the server action on submit.
        */}
        <HiddenFields draft={draft} />

        <Card>
          <CardContent className="space-y-6 py-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{current.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{current.description}</p>
            </div>

            {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}

            {step === 0 && (
              <StepBasics
                userId={profile.id}
                draft={draft}
                patch={patch}
                errors={state.errors ?? {}}
              />
            )}
            {step === 1 && <StepTags draft={draft} patch={patch} errors={state.errors ?? {}} />}
            {step === 2 && <StepLinks draft={draft} patch={patch} errors={state.errors ?? {}} />}
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>

          {isLastStep ? (
            <SubmitButton />
          ) : (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
              title={canAdvance ? undefined : 'Add your name and branch to continue'}
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function HiddenFields({ draft }: { draft: OnboardingDraft }) {
  return (
    <>
      <input type="hidden" name="full_name" value={draft.full_name} />
      <input type="hidden" name="year" value={draft.year} />
      <input type="hidden" name="branch" value={draft.branch} />
      <input type="hidden" name="bio" value={draft.bio} />
      <input type="hidden" name="avatar_url" value={draft.avatar_url ?? ''} />
      <input type="hidden" name="github_url" value={draft.github_url} />
      <input type="hidden" name="linkedin_url" value={draft.linkedin_url} />
      <input type="hidden" name="portfolio_url" value={draft.portfolio_url} />
      <input type="hidden" name="visibility" value={draft.visibility} />
      {draft.skills.map((skill) => (
        <input key={`skill-${skill}`} type="hidden" name="skills" value={skill} />
      ))}
      {draft.interests.map((interest) => (
        <input key={`interest-${interest}`} type="hidden" name="interests" value={interest} />
      ))}
    </>
  );
}

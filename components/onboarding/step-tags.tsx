'use client';

import { TagInput } from '@/components/ui/tag-input';
import {
  INTEREST_SUGGESTIONS,
  MAX_INTERESTS,
  MAX_SKILLS,
  SKILL_SUGGESTIONS,
} from '@/lib/constants';
import type { StepProps } from '@/components/onboarding/step-basics';

export function StepTags({ draft, patch, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <TagInput
        label="Skills"
        value={draft.skills}
        onChange={(skills) => patch({ skills })}
        suggestions={SKILL_SUGGESTIONS}
        max={MAX_SKILLS}
        placeholder="React, Python, UI design…"
        hint="What can you help other students with?"
        error={errors.skills}
      />

      <TagInput
        label="Interests"
        value={draft.interests}
        onChange={(interests) => patch({ interests })}
        suggestions={INTEREST_SUGGESTIONS}
        max={MAX_INTERESTS}
        placeholder="Hackathons, robotics, music…"
        hint="Used to suggest people you may want to know."
        error={errors.interests}
      />
    </div>
  );
}

'use client';

import { AvatarUpload } from '@/components/ui/avatar-upload';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BRANCHES, MAX_BIO_LENGTH, YEARS } from '@/lib/constants';
import { yearLabel } from '@/lib/utils';
import type { OnboardingDraft } from '@/components/onboarding/onboarding-wizard';

export interface StepProps {
  draft: OnboardingDraft;
  patch: (next: Partial<OnboardingDraft>) => void;
  errors: Record<string, string>;
}

/*
 * Inputs here are deliberately unnamed — the wizard mirrors the draft into
 * hidden inputs, so naming these too would submit each value twice.
 */
export function StepBasics({ userId, draft, patch, errors }: StepProps & { userId: string }) {
  return (
    <div className="space-y-5">
      <AvatarUpload
        userId={userId}
        name={draft.full_name}
        value={draft.avatar_url}
        onChange={(url) => patch({ avatar_url: url })}
      />

      <Input
        label="Full name"
        value={draft.full_name}
        onChange={(e) => patch({ full_name: e.target.value })}
        placeholder="Aditi Sharma"
        error={errors.full_name}
        required
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Year"
          value={draft.year}
          onChange={(e) => patch({ year: e.target.value })}
          error={errors.year}
        >
          <option value="">Select year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {yearLabel(y)}
            </option>
          ))}
        </Select>

        <Select
          label="Branch / department"
          value={draft.branch}
          onChange={(e) => patch({ branch: e.target.value })}
          error={errors.branch}
          required
        >
          <option value="">Select branch</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
      </div>

      <Textarea
        label="Bio"
        rows={4}
        value={draft.bio}
        onChange={(e) => patch({ bio: e.target.value })}
        placeholder="A couple of lines about what you are working on and what you are looking for."
        maxLengthCounter={MAX_BIO_LENGTH}
        error={errors.bio}
      />
    </div>
  );
}

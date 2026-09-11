'use client';

import { Github, Globe, Linkedin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { VISIBILITY_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { StepProps } from '@/components/onboarding/step-basics';

export function StepLinks({ draft, patch, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Input
          label="GitHub"
          value={draft.github_url}
          onChange={(e) => patch({ github_url: e.target.value })}
          placeholder="github.com/username"
          leftIcon={<Github className="h-4 w-4" />}
          error={errors.github_url}
        />
        <Input
          label="LinkedIn"
          value={draft.linkedin_url}
          onChange={(e) => patch({ linkedin_url: e.target.value })}
          placeholder="linkedin.com/in/username"
          leftIcon={<Linkedin className="h-4 w-4" />}
          error={errors.linkedin_url}
        />
        <Input
          label="Portfolio or website"
          value={draft.portfolio_url}
          onChange={(e) => patch({ portfolio_url: e.target.value })}
          placeholder="yoursite.com"
          leftIcon={<Globe className="h-4 w-4" />}
          error={errors.portfolio_url}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Who can see your profile</legend>
        <div className="space-y-2">
          {VISIBILITY_OPTIONS.map((option) => {
            const selected = draft.visibility === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                  selected
                    ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <input
                  type="radio"
                  checked={selected}
                  onChange={() => patch({ visibility: option.value })}
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                  <span className="block text-sm text-slate-500">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

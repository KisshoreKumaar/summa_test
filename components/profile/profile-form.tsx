'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Github, Globe, Linkedin } from 'lucide-react';
import { updateProfileAction, type ProfileFormState } from '@/lib/actions/profile';
import { Alert } from '@/components/ui/alert';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';
import {
  BRANCHES,
  INTEREST_SUGGESTIONS,
  MAX_BIO_LENGTH,
  MAX_INTERESTS,
  MAX_SKILLS,
  SKILL_SUGGESTIONS,
  VISIBILITY_OPTIONS,
  YEARS,
} from '@/lib/constants';
import { cn, yearLabel } from '@/lib/utils';
import type { Profile, ProfileVisibility } from '@/lib/types/database';

const initialState: ProfileFormState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Save changes
    </Button>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useFormState(updateProfileAction, initialState);

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [skills, setSkills] = useState<string[]>(profile.skills ?? []);
  const [interests, setInterests] = useState<string[]>(profile.interests ?? []);
  const [visibility, setVisibility] = useState<ProfileVisibility>(profile.visibility);
  const [fullName, setFullName] = useState(profile.full_name ?? '');

  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="avatar_url" value={avatarUrl ?? ''} />
      <input type="hidden" name="visibility" value={visibility} />
      {skills.map((s) => (
        <input key={`s-${s}`} type="hidden" name="skills" value={s} />
      ))}
      {interests.map((i) => (
        <input key={`i-${i}`} type="hidden" name="interests" value={i} />
      ))}

      {errors._form && <Alert tone="error">{errors._form}</Alert>}

      <Card>
        <CardContent className="space-y-5 py-6">
          <AvatarUpload
            userId={profile.id}
            name={fullName}
            value={avatarUrl}
            onChange={setAvatarUrl}
          />

          <Input
            name="full_name"
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.full_name}
            required
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              name="year"
              label="Year"
              defaultValue={profile.year ? String(profile.year) : ''}
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
              name="branch"
              label="Branch / department"
              defaultValue={profile.branch ?? ''}
              error={errors.branch}
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
            name="bio"
            label="Bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLengthCounter={MAX_BIO_LENGTH}
            error={errors.bio}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 py-6">
          <TagInput
            label="Skills"
            value={skills}
            onChange={setSkills}
            suggestions={SKILL_SUGGESTIONS}
            max={MAX_SKILLS}
            error={errors.skills}
          />
          <TagInput
            label="Interests"
            value={interests}
            onChange={setInterests}
            suggestions={INTEREST_SUGGESTIONS}
            max={MAX_INTERESTS}
            error={errors.interests}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 py-6">
          <Input
            name="github_url"
            label="GitHub"
            defaultValue={profile.github_url ?? ''}
            placeholder="github.com/username"
            leftIcon={<Github className="h-4 w-4" />}
            error={errors.github_url}
          />
          <Input
            name="linkedin_url"
            label="LinkedIn"
            defaultValue={profile.linkedin_url ?? ''}
            placeholder="linkedin.com/in/username"
            leftIcon={<Linkedin className="h-4 w-4" />}
            error={errors.linkedin_url}
          />
          <Input
            name="portfolio_url"
            label="Portfolio or website"
            defaultValue={profile.portfolio_url ?? ''}
            placeholder="yoursite.com"
            leftIcon={<Globe className="h-4 w-4" />}
            error={errors.portfolio_url}
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">
              Who can see your profile
            </legend>
            <div className="space-y-2">
              {VISIBILITY_OPTIONS.map((option) => {
                const selected = visibility === option.value;
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
                      onChange={() => setVisibility(option.value)}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">
                        {option.label}
                      </span>
                      <span className="block text-sm text-slate-500">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </CardContent>

        <CardFooter className="justify-end">
          <Link href={`/profile/${profile.id}`}>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <SaveButton />
        </CardFooter>
      </Card>
    </form>
  );
}

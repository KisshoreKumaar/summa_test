'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  leaveMentorDirectoryAction,
  saveMentorProfileAction,
  type MentorshipActionState,
} from '@/lib/actions/mentorship';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';
import { SKILL_SUGGESTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Mentor } from '@/lib/types/database';

const initialState: MentorshipActionState = {};

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {isNew ? 'Join the directory' : 'Save changes'}
    </Button>
  );
}

function LeaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" loading={pending}>
      Leave the directory
    </Button>
  );
}

export function MentorProfileForm({ mentor }: { mentor: Mentor | null }) {
  const [state, formAction] = useFormState(saveMentorProfileAction, initialState);
  const [leaveState, leaveAction] = useFormState(leaveMentorDirectoryAction, initialState);

  const [expertise, setExpertise] = useState<string[]>(mentor?.expertise ?? []);
  const [bio, setBio] = useState(mentor?.bio ?? '');
  const [isActive, setIsActive] = useState(mentor?.is_active ?? true);

  const error = state.errors?._form ?? leaveState.errors?._form;
  const message = state.message ?? leaveState.message;

  return (
    <div className="space-y-4">
      <form action={formAction}>
        {expertise.map((tag) => (
          <input key={tag} type="hidden" name="expertise" value={tag} />
        ))}
        <input type="hidden" name="is_active" value={String(isActive)} />

        <Card>
          <CardContent className="space-y-5 py-6">
            {error && <Alert tone="error">{error}</Alert>}
            {message && <Alert tone="success">{message}</Alert>}

            <TagInput
              label="What can you help with?"
              value={expertise}
              onChange={setExpertise}
              suggestions={SKILL_SUGGESTIONS}
              max={12}
              placeholder="Machine Learning, interviews, research…"
              hint="Students filter the directory by these."
              error={state.errors?.expertise}
            />

            <Textarea
              name="bio"
              label="A note for mentees"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What you are happy to help with, and how you prefer to work."
              maxLengthCounter={800}
              error={state.errors?.bio}
            />

            {mentor && (
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  isActive ? 'border-slate-200' : 'border-amber-300 bg-amber-50/60',
                )}
              >
                <input
                  type="checkbox"
                  checked={!isActive}
                  onChange={(e) => setIsActive(!e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-amber-600"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">
                    Pause new requests
                  </span>
                  <span className="block text-sm text-slate-500">
                    You stay in the directory but stop appearing as available, and nobody new
                    can request you.
                  </span>
                </span>
              </label>
            )}
          </CardContent>

          <CardFooter className="justify-end">
            <SaveButton isNew={!mentor} />
          </CardFooter>
        </Card>
      </form>

      {mentor && (
        <form action={leaveAction} className="flex justify-end">
          <LeaveButton />
        </form>
      )}
    </div>
  );
}

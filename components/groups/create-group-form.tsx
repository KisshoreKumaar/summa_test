'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createGroupAction, type GroupActionState } from '@/lib/actions/groups';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { cn } from '@/lib/utils';

const initialState: GroupActionState = {};

const TYPES = [
  {
    value: 'public' as const,
    label: 'Public',
    description: 'Anyone can find the group and join instantly.',
  },
  {
    value: 'private' as const,
    label: 'Private',
    description: 'Anyone can find it, but joining needs an admin’s approval.',
  },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Create group
    </Button>
  );
}

export function CreateGroupForm({ userId }: { userId: string }) {
  const [state, formAction] = useFormState(createGroupAction, initialState);
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="cover_url" value={coverUrl ?? ''} />

      {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}

      <Card>
        <CardContent className="space-y-5 py-6">
          <ImageUpload
            bucket="group-covers"
            userId={userId}
            value={coverUrl}
            onChange={setCoverUrl}
          />

          <Input
            name="name"
            label="Group name"
            placeholder="Robotics Club"
            error={state.errors?.name}
            required
          />

          <Textarea
            name="description"
            label="Description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this group for?"
            maxLengthCounter={500}
            error={state.errors?.description}
          />

          <Select name="category" label="Category" defaultValue="interest">
            <option value="club">Club</option>
            <option value="project">Project</option>
            <option value="interest">Interest</option>
          </Select>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Who can join</legend>
            <div className="space-y-2">
              {TYPES.map((option) => {
                const selected = type === option.value;
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
                      onChange={() => setType(option.value)}
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
          <Link href="/groups">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Submit />
        </CardFooter>
      </Card>
    </form>
  );
}

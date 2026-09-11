'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createEventAction, type EventActionState } from '@/lib/actions/events';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DateTimeField, localiseEventTimes } from '@/components/events/local-datetime-fields';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { CATEGORY_LABEL } from '@/components/events/event-card';
import type { EventCategory } from '@/lib/types/database';

const initialState: EventActionState = {};

const CATEGORIES: EventCategory[] = [
  'workshop', 'talk', 'competition', 'social', 'sports', 'cultural', 'other',
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Publish event
    </Button>
  );
}

export function CreateEventForm({ userId }: { userId: string }) {
  const [state, formAction] = useFormState(createEventAction, initialState);
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  return (
    <form
      action={(formData) => {
        // Runs in the browser, so the wall-clock values resolve against the
        // admin's own zone rather than the server's.
        localiseEventTimes(formData);
        return formAction(formData);
      }}
      className="space-y-6"
    >
      <input type="hidden" name="cover_url" value={coverUrl ?? ''} />

      {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}

      <Card>
        <CardContent className="space-y-5 py-6">
          <ImageUpload
            bucket="event-covers"
            userId={userId}
            value={coverUrl}
            onChange={setCoverUrl}
          />

          <Input
            name="title"
            label="Title"
            placeholder="Intro to Robotics Workshop"
            error={state.errors?.title}
            required
          />

          <Textarea
            name="description"
            label="Description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is it, who is it for, what should people bring?"
            maxLengthCounter={2000}
            error={state.errors?.description}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <DateTimeField
              name="start_time"
              label="Starts"
              error={state.errors?.start_time}
              required
            />
            <DateTimeField name="end_time" label="Ends (optional)" error={state.errors?.end_time} />
          </div>

          <Input
            name="location"
            label="Location"
            placeholder="Lab 3, or a meeting link"
            hint="A room name, or paste a joining link — both work."
            error={state.errors?.location}
          />

          <Select name="category" label="Category" defaultValue="other">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </CardContent>

        <CardFooter className="justify-end">
          <Link href="/events">
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

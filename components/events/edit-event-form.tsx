'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updateEventAction, type EventActionState } from '@/lib/actions/events';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { CATEGORY_LABEL } from '@/components/events/event-card';
import { DateTimeField, localiseEventTimes } from '@/components/events/local-datetime-fields';
import type { EventCategory, EventWithMeta } from '@/lib/types/database';

const initialState: EventActionState = {};

const CATEGORIES: EventCategory[] = [
  'workshop', 'talk', 'competition', 'social', 'sports', 'cultural', 'other',
];

/**
 * `datetime-local` needs a local wall-clock string, but the stored value is an
 * instant. Convert back into the viewer's zone for editing; the submit handler
 * converts forward again.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Save changes
    </Button>
  );
}

export function EditEventForm({ event, userId }: { event: EventWithMeta; userId: string }) {
  const [state, formAction] = useFormState(updateEventAction, initialState);
  const [description, setDescription] = useState(event.description ?? '');
  const [coverUrl, setCoverUrl] = useState<string | null>(event.cover_url);

  return (
    <form
      action={(formData) => {
        localiseEventTimes(formData);
        return formAction(formData);
      }}
      className="space-y-6"
    >
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="cover_url" value={coverUrl ?? ''} />

      {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

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
            defaultValue={event.title}
            error={state.errors?.title}
            required
          />

          <Textarea
            name="description"
            label="Description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLengthCounter={2000}
            error={state.errors?.description}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <DateTimeField
              name="start_time"
              label="Starts"
              defaultValue={toLocalInput(event.start_time)}
              error={state.errors?.start_time}
              required
            />
            <DateTimeField
              name="end_time"
              label="Ends (optional)"
              defaultValue={toLocalInput(event.end_time)}
              error={state.errors?.end_time}
            />
          </div>

          <Input
            name="location"
            label="Location"
            defaultValue={event.location ?? ''}
            error={state.errors?.location}
          />

          <Select name="category" label="Category" defaultValue={event.category}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </CardContent>

        <CardFooter className="justify-end">
          <Link href={`/events/${event.id}`}>
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

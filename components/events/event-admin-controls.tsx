'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteEventAction, type EventActionState } from '@/lib/actions/events';
import { Button } from '@/components/ui/button';

const initialState: EventActionState = {};

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" loading={pending}>
      <Trash2 className="h-4 w-4" aria-hidden />
      Delete
    </Button>
  );
}

export function EventAdminControls({ eventId }: { eventId: string }) {
  const [state, formAction] = useFormState(deleteEventAction, initialState);

  return (
    <div className="flex flex-wrap items-start gap-2">
      <Link href={`/events/${eventId}/edit`}>
        <Button type="button" variant="outline" size="sm">
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </Button>
      </Link>
      <form action={formAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <DeleteButton />
      </form>
      {state.errors?._form && (
        <p className="mt-1 w-full text-xs text-red-600">{state.errors._form}</p>
      )}
    </div>
  );
}

'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { CalendarCheck } from 'lucide-react';
import {
  bookSlotAction,
  releaseSlotAction,
  type MentorshipActionState,
} from '@/lib/actions/mentorship';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EventTime } from '@/components/events/event-time';
import type { MentorAvailability } from '@/lib/types/database';

const initialState: MentorshipActionState = {};

function BookButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Book
    </Button>
  );
}

export function SlotPicker({
  mentorId,
  slots,
  bookedSlot,
}: {
  mentorId: string;
  slots: MentorAvailability[];
  bookedSlot: MentorAvailability | null;
}) {
  const [bookState, book] = useFormState(bookSlotAction, initialState);
  const [releaseState, release] = useFormState(releaseSlotAction, initialState);

  const error = bookState.errors?._form ?? releaseState.errors?._form;

  if (bookedSlot) {
    return (
      <div className="mt-3 space-y-3">
        <Alert tone="success" title="Session booked">
          <EventTime start={bookedSlot.slot_start} end={bookedSlot.slot_end} />
          <p className="mt-1">
            Release this one if you need a different time — you can hold one session with
            a mentor at a time.
          </p>
        </Alert>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <form action={release}>
          <input type="hidden" name="slotId" value={bookedSlot.id} />
          <input type="hidden" name="mentorId" value={mentorId} />
          <Button type="submit" size="sm" variant="ghost">
            Release this slot
          </Button>
        </form>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-600">
        No open slots right now. Check back later.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-slate-100">
        {slots.map((slot) => (
          <li key={slot.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-slate-700">
              <CalendarCheck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <EventTime start={slot.slot_start} end={slot.slot_end} />
            </span>
            <form action={book}>
              <input type="hidden" name="slotId" value={slot.id} />
              <input type="hidden" name="mentorId" value={mentorId} />
              <BookButton />
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

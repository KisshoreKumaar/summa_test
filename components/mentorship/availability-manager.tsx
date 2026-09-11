'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { CalendarPlus, Trash2 } from 'lucide-react';
import {
  addAvailabilityAction,
  removeAvailabilityAction,
  type MentorshipActionState,
} from '@/lib/actions/mentorship';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateTimeField, localiseFields } from '@/components/events/local-datetime-fields';
import { EventTime } from '@/components/events/event-time';
import { Avatar } from '@/components/ui/avatar';
import type { MentorSlotWithBooker } from '@/lib/types/database';

const initialState: MentorshipActionState = {};

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      <CalendarPlus className="h-4 w-4" aria-hidden />
      Add slot
    </Button>
  );
}

export function AvailabilityManager({ slots }: { slots: MentorSlotWithBooker[] }) {
  const [addState, add] = useFormState(addAvailabilityAction, initialState);
  const [removeState, remove] = useFormState(removeAvailabilityAction, initialState);

  const error = addState.errors?._form ?? removeState.errors?._form;

  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <div>
          <h2 className="font-semibold text-slate-900">Your availability</h2>
          <p className="mt-1 text-sm text-slate-600">
            Mentees you have accepted can book any open slot.
          </p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <form
          action={(formData) => {
            // Same wall-clock-to-instant conversion the event form uses.
            localiseFields(formData, 'slot_start', 'slot_end');
            return add(formData);
          }}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <DateTimeField name="slot_start" label="From" required />
          <DateTimeField name="slot_end" label="To" error={addState.errors?.slot_end} required />
          <div className="pb-1">
            <AddButton />
          </div>
        </form>

        {slots.length === 0 ? (
          <p className="text-sm text-slate-500">No slots yet. Add one above.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {slots.map((slot) => (
              <li key={slot.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 text-sm text-slate-700">
                  <EventTime start={slot.slot_start} end={slot.slot_end} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {slot.is_booked ? (
                    // Say who booked it; "Booked" alone left the mentor guessing.
                    <span className="flex items-center gap-1.5">
                      <Avatar
                        src={slot.booker?.avatar_url}
                        name={slot.booker?.full_name}
                        size="xs"
                      />
                      <Badge tone="green">
                        {slot.booker?.full_name ?? 'Booked'}
                      </Badge>
                    </span>
                  ) : (
                    <Badge tone="slate">Open</Badge>
                  )}
                  {!slot.is_booked && (
                    <form action={remove}>
                      <input type="hidden" name="slotId" value={slot.id} />
                      <button
                        type="submit"
                        aria-label="Remove slot"
                        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

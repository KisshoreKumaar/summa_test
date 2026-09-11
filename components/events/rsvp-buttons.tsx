'use client';

import { useFormState } from 'react-dom';
import { Check, HelpCircle, X } from 'lucide-react';
import { setRsvpAction, type EventActionState } from '@/lib/actions/events';
import { cn } from '@/lib/utils';
import type { RsvpStatus } from '@/lib/types/database';

const initialState: EventActionState = {};

const OPTIONS: { value: RsvpStatus; label: string; Icon: typeof Check }[] = [
  { value: 'going', label: 'Going', Icon: Check },
  { value: 'interested', label: 'Interested', Icon: HelpCircle },
  { value: 'not_going', label: "Can't go", Icon: X },
];

/**
 * Tapping the active choice again clears the RSVP, which is why `current` is
 * submitted alongside the new value.
 */
export function RsvpButtons({
  eventId,
  current,
  size = 'md',
}: {
  eventId: string;
  current: RsvpStatus | null;
  size?: 'sm' | 'md';
}) {
  const [state, formAction] = useFormState(setRsvpAction, initialState);

  return (
    <div>
      <div
        className="inline-flex rounded-lg border border-slate-200 p-0.5"
        role="group"
        aria-label="Your response"
      >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = current === value;
        return (
          <form key={value} action={formAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="status" value={value} />
            <input type="hidden" name="current" value={current ?? ''} />
            <button
              type="submit"
              aria-pressed={active}
              className={cn(
                'flex items-center gap-1.5 rounded-md font-medium transition-colors',
                size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
                active
                  ? value === 'going'
                    ? 'bg-emerald-600 text-white'
                    : value === 'interested'
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
              {label}
            </button>
          </form>
          );
      })}
      </div>
      {state.errors?._form && (
        <p className="mt-1 text-xs text-red-600">{state.errors._form}</p>
      )}
    </div>
  );
}

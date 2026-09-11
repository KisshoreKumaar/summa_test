'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { Check, X } from 'lucide-react';
import {
  respondToMentorshipAction,
  withdrawMentorshipAction,
  type MentorshipActionState,
} from '@/lib/actions/mentorship';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EventTime } from '@/components/events/event-time';
import { yearLabel } from '@/lib/utils';
import type { MentorshipRequestWithPeople, MentorshipStatus } from '@/lib/types/database';

const initialState: MentorshipActionState = {};

const STATUS_TONE: Record<MentorshipStatus, 'amber' | 'green' | 'slate' | 'red'> = {
  requested: 'amber',
  accepted: 'green',
  declined: 'red',
  completed: 'slate',
};

const STATUS_LABEL: Record<MentorshipStatus, string> = {
  requested: 'Pending',
  accepted: 'Active',
  declined: 'Declined',
  completed: 'Completed',
};

export function RequestList({
  requests,
  role,
}: {
  requests: MentorshipRequestWithPeople[];
  role: 'mentor' | 'mentee';
}) {
  const [respondState, respond] = useFormState(respondToMentorshipAction, initialState);
  const [withdrawState, withdraw] = useFormState(withdrawMentorshipAction, initialState);

  const error = respondState.errors?._form ?? withdrawState.errors?._form;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {requests.map((request) => {
        const person = role === 'mentor' ? request.mentee : request.mentor;
        const subtitle = [yearLabel(person?.year), person?.branch].filter(Boolean).join(' · ');

        return (
          <Card key={request.id}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Link href={`/profile/${person?.id ?? ''}`} className="shrink-0">
                  <Avatar src={person?.avatar_url} name={person?.full_name} size="md" />
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/profile/${person?.id ?? ''}`}
                      className="truncate font-medium text-slate-900 hover:text-brand-600"
                    >
                      {person?.full_name ?? 'Unnamed student'}
                    </Link>
                    <Badge tone={STATUS_TONE[request.status]}>
                      {STATUS_LABEL[request.status]}
                    </Badge>
                  </div>
                  {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}

                  <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                    {request.message}
                  </p>

                  {request.slot && (
                    <p className="mt-2 text-sm text-brand-700">
                      Booked: <EventTime start={request.slot.slot_start} end={request.slot.slot_end} />
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {role === 'mentor' && request.status === 'requested' && (
                      <>
                        <form action={respond}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="decision" value="accepted" />
                          <Button type="submit" size="sm">
                            <Check className="h-4 w-4" aria-hidden />
                            Accept
                          </Button>
                        </form>
                        <form action={respond}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="decision" value="declined" />
                          <Button type="submit" size="sm" variant="outline">
                            <X className="h-4 w-4" aria-hidden />
                            Decline
                          </Button>
                        </form>
                      </>
                    )}

                    {request.status === 'accepted' && (
                      <form action={respond}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="decision" value="completed" />
                        <Button type="submit" size="sm" variant="outline">
                          Mark completed
                        </Button>
                      </form>
                    )}

                    {role === 'mentee' && request.status === 'requested' && (
                      <form action={withdraw}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Withdraw
                        </Button>
                      </form>
                    )}

                    {role === 'mentee' && request.status === 'accepted' && (
                      <Link href={`/mentorship/${request.mentor_id}`}>
                        <Button type="button" size="sm" variant="outline">
                          Book a slot
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

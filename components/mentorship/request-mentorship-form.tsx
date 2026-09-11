'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Send } from 'lucide-react';
import { requestMentorshipAction, type MentorshipActionState } from '@/lib/actions/mentorship';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { MentorshipRequestWithPeople } from '@/lib/types/database';

const initialState: MentorshipActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      <Send className="h-4 w-4" aria-hidden />
      Send request
    </Button>
  );
}

export function RequestMentorshipForm({
  mentorId,
  mentorship,
}: {
  mentorId: string;
  mentorship: MentorshipRequestWithPeople | null;
}) {
  const [state, formAction] = useFormState(requestMentorshipAction, initialState);

  if (mentorship?.status === 'requested') {
    return (
      <Alert tone="info" title="Request sent">
        Waiting for a reply. You will get a notification when they respond.
      </Alert>
    );
  }

  if (mentorship?.status === 'accepted') {
    return (
      <Alert tone="success" title="You are being mentored by this student">
        Book one of the slots below to arrange a session.
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="mentorId" value={mentorId} />

          {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}
          {state.message && <Alert tone="success">{state.message}</Alert>}

          {mentorship?.status === 'declined' && (
            <Alert tone="info">
              A previous request was declined. You can send another one.
            </Alert>
          )}
          {mentorship?.status === 'completed' && (
            <Alert tone="info">
              You have worked with this mentor before. You can ask again.
            </Alert>
          )}

          <Textarea
            name="message"
            label="What would you like help with?"
            rows={4}
            placeholder="A couple of lines about what you are working on and where you are stuck."
            maxLengthCounter={1000}
            error={state.errors?.message}
            required
          />

          <div className="flex justify-end">
            <Submit />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

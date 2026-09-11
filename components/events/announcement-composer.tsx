'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Megaphone } from 'lucide-react';
import { createAnnouncementAction, type EventActionState } from '@/lib/actions/events';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const initialState: EventActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      <Megaphone className="h-4 w-4" aria-hidden />
      Publish
    </Button>
  );
}

export function AnnouncementComposer() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(createAnnouncementAction, initialState);
  const [content, setContent] = useState('');

  return (
    <Card>
      <CardContent className="py-5">
        <form
          ref={formRef}
          action={async (formData) => {
            await formAction(formData);
            formRef.current?.reset();
            setContent('');
          }}
          className="space-y-4"
        >
          {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}
          {state.message && <Alert tone="success">{state.message}</Alert>}

          <Input
            name="title"
            label="Announcement"
            placeholder="Exam timetable published"
            error={state.errors?.title}
            required
          />

          <Textarea
            name="content"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="The details…"
            maxLengthCounter={5000}
            error={state.errors?.content}
            required
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="pinned" className="h-4 w-4 accent-brand-600" />
              Pin to the top of the feed
            </label>
            <Submit />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

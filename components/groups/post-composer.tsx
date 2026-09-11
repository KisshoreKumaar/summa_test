'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Send } from 'lucide-react';
import { createPostAction, type GroupActionState } from '@/lib/actions/groups';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

const initialState: GroupActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      <Send className="h-4 w-4" aria-hidden />
      Post
    </Button>
  );
}

export function PostComposer({
  groupId,
  authorName,
  authorAvatar,
}: {
  groupId: string;
  authorName: string | null;
  authorAvatar: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(createPostAction, initialState);

  return (
    <Card>
      <CardContent className="py-4">
        <form
          ref={formRef}
          action={async (formData) => {
            await formAction(formData);
            formRef.current?.reset();
          }}
          className="flex gap-3"
        >
          <input type="hidden" name="groupId" value={groupId} />
          <Avatar src={authorAvatar} name={authorName} size="md" className="mt-1 shrink-0" />

          <div className="min-w-0 flex-1">
            <Textarea
              name="content"
              rows={3}
              placeholder="Share something with the group…"
              aria-label="Write a post"
              error={state.errors?.content}
              required
            />
            {state.errors?._form && (
              <p className="mt-1 text-sm text-red-600">{state.errors._form}</p>
            )}
            <div className="mt-2 flex justify-end">
              <Submit />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

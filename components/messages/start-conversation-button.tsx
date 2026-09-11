'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { MessageSquare } from 'lucide-react';
import {
  openDirectMessageAction,
  openGroupChatAction,
  type MessageActionState,
} from '@/lib/actions/messages';
import { Button, type ButtonProps } from '@/components/ui/button';

const initialState: MessageActionState = {};

function Submit({ label, size }: { label: string; size?: ButtonProps['size'] }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size={size} loading={pending}>
      <MessageSquare className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}

/** Opens (or reuses) the DM with a connection. */
export function StartDirectMessage({
  userId,
  size = 'sm',
}: {
  userId: string;
  size?: ButtonProps['size'];
}) {
  const [state, formAction] = useFormState(openDirectMessageAction, initialState);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <Submit label="Message" size={size} />
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

export function OpenGroupChat({
  groupId,
  size = 'sm',
}: {
  groupId: string;
  size?: ButtonProps['size'];
}) {
  const [state, formAction] = useFormState(openGroupChatAction, initialState);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="groupId" value={groupId} />
        <Submit label="Group chat" size={size} />
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

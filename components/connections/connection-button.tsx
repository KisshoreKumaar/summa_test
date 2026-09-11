'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Check, Clock, UserCheck, UserPlus, UserX, X } from 'lucide-react';
import {
  removeConnection,
  respondToRequest,
  sendConnectionRequest,
  type ConnectionActionState,
} from '@/lib/actions/connections';
import { Button, type ButtonProps } from '@/components/ui/button';
import type { ConnectionState } from '@/lib/types/database';

const initialState: ConnectionActionState = {};

function SubmitButton({
  children,
  ...props
}: ButtonProps & { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  );
}

export interface ConnectionButtonProps {
  profileId: string;
  state: ConnectionState | null;
  size?: ButtonProps['size'];
}

/**
 * Renders whichever action makes sense for the viewer's current relationship
 * with `profileId`: connect, cancel, accept/decline, or disconnect.
 */
export function ConnectionButton({ profileId, state, size = 'sm' }: ConnectionButtonProps) {
  if (!state) return <SendRequest profileId={profileId} size={size} />;

  if (state.status === 'accepted') {
    return <Disconnect connectionId={state.connection_id} profileId={profileId} size={size} />;
  }

  if (state.status === 'pending' && state.direction === 'incoming') {
    return <Respond connectionId={state.connection_id} profileId={profileId} size={size} />;
  }

  if (state.status === 'pending') {
    return <CancelRequest connectionId={state.connection_id} profileId={profileId} size={size} />;
  }

  /*
   * Rejected. Only the addressee may clear the row (see the delete policy), so
   * the requester gets a dead end rather than a button that would fail: the
   * rejection is meant to stick.
   */
  if (state.direction === 'incoming') {
    return (
      <Disconnect
        connectionId={state.connection_id}
        profileId={profileId}
        size={size}
        label="Declined"
      />
    );
  }

  return (
    <Button size={size} variant="ghost" disabled title="This request was declined">
      <UserX className="h-4 w-4" aria-hidden />
      Request declined
    </Button>
  );
}

function SendRequest({ profileId, size }: { profileId: string; size: ButtonProps['size'] }) {
  const [state, formAction] = useFormState(sendConnectionRequest, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="addresseeId" value={profileId} />
      <SubmitButton size={size}>
        <UserPlus className="h-4 w-4" aria-hidden />
        Connect
      </SubmitButton>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function CancelRequest({
  connectionId,
  profileId,
  size,
}: {
  connectionId: string;
  profileId: string;
  size: ButtonProps['size'];
}) {
  const [state, formAction] = useFormState(removeConnection, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="connectionId" value={connectionId} />
      <input type="hidden" name="profileId" value={profileId} />
      <SubmitButton size={size} variant="outline">
        <Clock className="h-4 w-4" aria-hidden />
        Cancel request
      </SubmitButton>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function Respond({
  connectionId,
  profileId,
  size,
}: {
  connectionId: string;
  profileId: string;
  size: ButtonProps['size'];
}) {
  const [state, formAction] = useFormState(respondToRequest, initialState);

  return (
    <div>
      <div className="flex gap-2">
        <form action={formAction}>
          <input type="hidden" name="connectionId" value={connectionId} />
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="decision" value="accepted" />
          <SubmitButton size={size}>
            <Check className="h-4 w-4" aria-hidden />
            Accept
          </SubmitButton>
        </form>
        <form action={formAction}>
          <input type="hidden" name="connectionId" value={connectionId} />
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="decision" value="rejected" />
          <SubmitButton size={size} variant="outline">
            <X className="h-4 w-4" aria-hidden />
            Decline
          </SubmitButton>
        </form>
      </div>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

function Disconnect({
  connectionId,
  profileId,
  size,
  label = 'Connected',
}: {
  connectionId: string;
  profileId: string;
  size: ButtonProps['size'];
  label?: string;
}) {
  const [state, formAction] = useFormState(removeConnection, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="connectionId" value={connectionId} />
      <input type="hidden" name="profileId" value={profileId} />
      <SubmitButton size={size} variant="outline" className="group">
        <UserCheck className="h-4 w-4 group-hover:hidden" aria-hidden />
        <X className="hidden h-4 w-4 group-hover:block" aria-hidden />
        <span className="group-hover:hidden">{label}</span>
        <span className="hidden group-hover:inline">Remove</span>
      </SubmitButton>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

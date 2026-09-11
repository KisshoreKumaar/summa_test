'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Check, Clock, LogOut, UserPlus } from 'lucide-react';
import {
  joinGroupAction,
  leaveGroupAction,
  type GroupActionState,
} from '@/lib/actions/groups';
import { Button, type ButtonProps } from '@/components/ui/button';
import type { GroupWithMembership } from '@/lib/types/database';

const initialState: GroupActionState = {};

function Submit({ children, ...props }: ButtonProps & { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  );
}

export function JoinButton({
  group,
  size = 'md',
}: {
  group: GroupWithMembership;
  size?: ButtonProps['size'];
}) {
  const [joinState, join] = useFormState(joinGroupAction, initialState);
  const [leaveState, leave] = useFormState(leaveGroupAction, initialState);

  const error = joinState.errors?._form ?? leaveState.errors?._form;

  if (group.viewer_status === 'pending') {
    return (
      <div>
        <Button size={size} variant="outline" disabled>
          <Clock className="h-4 w-4" aria-hidden />
          Awaiting approval
        </Button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (group.viewer_status === 'active') {
    /*
     * Owners cannot leave — the delete policy blocks it, precisely so a group
     * is never stranded without an administrator. The way out is the transfer
     * control in the member list.
     */
    if (group.viewer_role === 'owner') {
      return (
        <Button
          size={size}
          variant="outline"
          disabled
          title="Transfer ownership to another member before leaving"
        >
          <Check className="h-4 w-4" aria-hidden />
          Owner
        </Button>
      );
    }

    return (
      <div>
        <form action={leave}>
          <input type="hidden" name="groupId" value={group.id} />
          <Submit size={size} variant="outline" className="group">
            <Check className="h-4 w-4 group-hover:hidden" aria-hidden />
            <LogOut className="hidden h-4 w-4 group-hover:block" aria-hidden />
            <span className="group-hover:hidden">Joined</span>
            <span className="hidden group-hover:inline">Leave</span>
          </Submit>
        </form>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <form action={join}>
        <input type="hidden" name="groupId" value={group.id} />
        <Submit size={size}>
          <UserPlus className="h-4 w-4" aria-hidden />
          {group.type === 'private' ? 'Request to join' : 'Join group'}
        </Submit>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { resolveGroupRequestAction, type AdminActionState } from '@/lib/actions/admin';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PendingGroupRequest } from '@/lib/types/database';

const initialState: AdminActionState = {};

export function GroupRequestQueue({ requests }: { requests: PendingGroupRequest[] }) {
  const [state, resolve] = useFormState(resolveGroupRequestAction, initialState);

  return (
    <div className="space-y-3">
      {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      {requests.map((request) => (
        <Card key={`${request.group_id}-${request.user_id}`}>
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <Avatar
              src={request.avatar_url}
              name={request.full_name}
              size="md"
              className="shrink-0"
            />

            <div className="min-w-0 flex-1">
              <Link
                href={`/profile/${request.user_id}`}
                className="block truncate font-medium text-slate-900 hover:text-brand-600"
              >
                {request.full_name ?? 'Unnamed student'}
              </Link>
              <p className="truncate text-sm text-slate-600">
                wants to join{' '}
                <Link
                  href={`/groups/${request.group_id}`}
                  className="text-brand-600 hover:text-brand-700"
                >
                  {request.group_name}
                </Link>
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <form action={resolve}>
                <input type="hidden" name="groupId" value={request.group_id} />
                <input type="hidden" name="userId" value={request.user_id} />
                <input type="hidden" name="decision" value="approve" />
                <Button type="submit" size="sm">
                  Approve
                </Button>
              </form>
              <form action={resolve}>
                <input type="hidden" name="groupId" value={request.group_id} />
                <input type="hidden" name="userId" value={request.user_id} />
                <input type="hidden" name="decision" value="decline" />
                <Button type="submit" size="sm" variant="outline">
                  Decline
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

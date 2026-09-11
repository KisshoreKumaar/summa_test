'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { Crown, Shield, UserMinus } from 'lucide-react';
import {
  removeMemberAction,
  respondToJoinRequestAction,
  transferOwnershipAction,
  updateMemberRoleAction,
  type GroupActionState,
} from '@/lib/actions/groups';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { yearLabel } from '@/lib/utils';
import type { GroupMemberWithProfile } from '@/lib/types/database';

const initialState: GroupActionState = {};

export function PendingRequests({
  groupId,
  requests,
}: {
  groupId: string;
  requests: GroupMemberWithProfile[];
}) {
  const [state, respond] = useFormState(respondToJoinRequestAction, initialState);

  if (requests.length === 0) return null;

  return (
    <Card>
      <CardContent className="py-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Join requests
          <Badge tone="amber" className="ml-2">
            {requests.length}
          </Badge>
        </h2>

        {state.errors?._form && (
          <p className="mt-2 text-sm text-red-600">{state.errors._form}</p>
        )}

        <ul className="mt-3 space-y-3">
          {requests.map(({ profile }) => (
            <li key={profile.id} className="flex items-center gap-3">
              <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
              <Link
                href={`/profile/${profile.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 hover:text-brand-600"
              >
                {profile.full_name ?? 'Unnamed student'}
              </Link>
              <div className="flex gap-2">
                <form action={respond}>
                  <input type="hidden" name="groupId" value={groupId} />
                  <input type="hidden" name="userId" value={profile.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <Button type="submit" size="sm">
                    Approve
                  </Button>
                </form>
                <form action={respond}>
                  <input type="hidden" name="groupId" value={groupId} />
                  <input type="hidden" name="userId" value={profile.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <Button type="submit" size="sm" variant="outline">
                    Decline
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function MemberList({
  groupId,
  members,
  canManage,
  isOwner,
  viewerId,
}: {
  groupId: string;
  members: GroupMemberWithProfile[];
  canManage: boolean;
  isOwner: boolean;
  viewerId: string;
}) {
  const [roleState, changeRole] = useFormState(updateMemberRoleAction, initialState);
  const [removeState, removeMember] = useFormState(removeMemberAction, initialState);
  const [transferState, transfer] = useFormState(transferOwnershipAction, initialState);

  const error =
    roleState.errors?._form ?? removeState.errors?._form ?? transferState.errors?._form;
  const notice = transferState.message;

  return (
    <Card>
      <CardContent className="py-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Members <span className="text-slate-400">({members.length})</span>
        </h2>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {notice && <p className="mt-2 text-sm text-emerald-700">{notice}</p>}

        <ul className="mt-3 space-y-3">
          {members.map(({ profile, role, user_id }) => {
            const subtitle = [yearLabel(profile.year), profile.branch].filter(Boolean).join(' · ');
            const manageable = canManage && role !== 'owner' && user_id !== viewerId;

            return (
              <li key={user_id} className="flex items-center gap-3">
                <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profile/${profile.id}`}
                    className="block truncate text-sm font-medium text-slate-900 hover:text-brand-600"
                  >
                    {profile.full_name ?? 'Unnamed student'}
                  </Link>
                  {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
                </div>

                {role !== 'member' && (
                  <Badge tone={role === 'owner' ? 'brand' : 'slate'}>
                    {role === 'owner' ? 'Owner' : 'Admin'}
                  </Badge>
                )}

                {manageable && (
                  <div className="flex gap-1">
                    {/* Only the owner can hand the group over, and only to an
                        existing active member. */}
                    {isOwner && (
                      <form action={transfer}>
                        <input type="hidden" name="groupId" value={groupId} />
                        <input type="hidden" name="userId" value={user_id} />
                        <button
                          type="submit"
                          aria-label={`Make ${profile.full_name ?? 'this member'} the owner`}
                          title="Transfer ownership"
                          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                        >
                          <Crown className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    )}
                    <form action={changeRole}>
                      <input type="hidden" name="groupId" value={groupId} />
                      <input type="hidden" name="userId" value={user_id} />
                      <input
                        type="hidden"
                        name="role"
                        value={role === 'admin' ? 'member' : 'admin'}
                      />
                      <button
                        type="submit"
                        aria-label={role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                        title={role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
                      >
                        <Shield className="h-3.5 w-3.5" />
                      </button>
                    </form>
                    <form action={removeMember}>
                      <input type="hidden" name="groupId" value={groupId} />
                      <input type="hidden" name="userId" value={user_id} />
                      <button
                        type="submit"
                        aria-label="Remove member"
                        title="Remove from group"
                        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

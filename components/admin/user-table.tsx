'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { Ban, Flag, UserCheck } from 'lucide-react';
import {
  setUserActiveAction,
  setUserRoleAction,
  type AdminActionState,
} from '@/lib/actions/admin';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { yearLabel } from '@/lib/utils';
import type { AdminUserRow, UserRole } from '@/lib/types/database';

const initialState: AdminActionState = {};

const ROLE_LABEL: Record<UserRole, string> = {
  student: 'Student',
  club_admin: 'Club admin',
  super_admin: 'Super admin',
};

export function UserTable({ users, viewerId }: { users: AdminUserRow[]; viewerId: string }) {
  const [activeState, setActive] = useFormState(setUserActiveAction, initialState);
  const [roleState, setRole] = useFormState(setUserRoleAction, initialState);

  const error = activeState.errors?._form ?? roleState.errors?._form;
  const message = activeState.message ?? roleState.message;

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      {users.map((user) => {
        const isSelf = user.id === viewerId;
        const subtitle = [yearLabel(user.year), user.branch].filter(Boolean).join(' · ');

        return (
          <Card key={user.id} className={!user.is_active ? 'bg-slate-50' : undefined}>
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              <Avatar name={user.full_name} size="md" className="shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/profile/${user.id}`}
                    className="truncate font-medium text-slate-900 hover:text-brand-600"
                  >
                    {user.full_name ?? 'Unnamed student'}
                  </Link>
                  {user.role !== 'student' && (
                    <Badge tone="brand">{ROLE_LABEL[user.role]}</Badge>
                  )}
                  {!user.is_active && <Badge tone="red">Deactivated</Badge>}
                  {!user.onboarded_at && <Badge tone="slate">Not onboarded</Badge>}
                  {user.open_reports > 0 && (
                    <Badge tone="amber">
                      <Flag className="mr-1 h-3 w-3" aria-hidden />
                      {user.open_reports}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
                {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {/* Acting on your own account is refused in SQL; hide it here too. */}
                {!isSelf && (
                  <>
                    <form action={setRole}>
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="role"
                        defaultValue={user.role}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        aria-label={`Role for ${user.full_name ?? 'this user'}`}
                        className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
                      >
                        <option value="student">Student</option>
                        <option value="club_admin">Club admin</option>
                        <option value="super_admin">Super admin</option>
                      </select>
                    </form>

                    <form action={setActive}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="active" value={String(!user.is_active)} />
                      <Button
                        type="submit"
                        size="sm"
                        variant={user.is_active ? 'outline' : 'primary'}
                      >
                        {user.is_active ? (
                          <>
                            <Ban className="h-4 w-4" aria-hidden />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4" aria-hidden />
                            Reactivate
                          </>
                        )}
                      </Button>
                    </form>
                  </>
                )}
                {isSelf && <span className="text-xs text-slate-400">That&rsquo;s you</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

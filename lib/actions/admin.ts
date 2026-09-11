'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ReportTargetType, UserRole } from '@/lib/types/database';

export interface AdminActionState {
  errors?: Record<string, string>;
  message?: string;
}

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Reporting — available to every signed-in user
// ---------------------------------------------------------------------------

export async function fileReportAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const targetType = String(formData.get('targetType') ?? '') as ReportTargetType;
  const targetId = String(formData.get('targetId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  if (!['post', 'message', 'user'].includes(targetType)) {
    return { errors: { _form: 'Invalid report.' } };
  }
  if (!targetId) return { errors: { _form: 'Missing target.' } };
  if (reason.length < 3) return { errors: { reason: 'Tell us briefly what is wrong.' } };
  if (reason.length > 1000) return { errors: { reason: 'Keep it under 1000 characters.' } };

  const { supabase, user } = await requireUser();

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
  });

  if (error) {
    if (error.code === '23505') {
      return { errors: { _form: 'You have already reported this. A moderator will look at it.' } };
    }
    return { errors: { _form: error.message } };
  }

  return { message: 'Reported. Thanks — a moderator will review it.' };
}

// ---------------------------------------------------------------------------
// Moderation — the RPCs re-check the caller's role
// ---------------------------------------------------------------------------

export async function resolveReportAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const reportId = String(formData.get('reportId') ?? '');
  const action = String(formData.get('action') ?? '');
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!['dismiss', 'resolve', 'remove'].includes(action)) {
    return { errors: { _form: 'Unknown action.' } };
  }

  const { supabase } = await requireUser();

  const { error } = await supabase.rpc('admin_resolve_report', {
    report: reportId,
    action,
    note,
  });

  if (error) return { errors: { _form: error.message } };

  revalidatePath('/admin/reports');
  revalidatePath('/admin');
  return {
    message:
      action === 'remove'
        ? 'Content removed and report closed.'
        : action === 'dismiss'
          ? 'Report dismissed.'
          : 'Report closed.',
  };
}

export async function setUserActiveAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const target = String(formData.get('userId') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('admin_set_user_active', { target, active });

  if (error) return { errors: { _form: error.message } };

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  return { message: active ? 'Account reactivated.' : 'Account deactivated.' };
}

export async function setUserRoleAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const target = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '') as UserRole;

  if (!['student', 'club_admin', 'super_admin'].includes(role)) {
    return { errors: { _form: 'Unknown role.' } };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('admin_set_user_role', { target, new_role: role });

  if (error) return { errors: { _form: error.message } };

  revalidatePath('/admin/users');
  return { message: 'Role updated.' };
}

/** Approve or decline a pending private-group request from the admin queue. */
export async function resolveGroupRequestAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const groupId = String(formData.get('groupId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const decision = String(formData.get('decision') ?? '');

  const { supabase } = await requireUser();

  // Group RLS already restricts this to admins of that group.
  const query =
    decision === 'approve'
      ? supabase
          .from('group_members')
          .update({ status: 'active' as const })
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .select('user_id')
      : supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .select('user_id');

  const { data, error } = await query;

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You cannot manage that request.' } };

  revalidatePath('/admin/groups');
  revalidatePath('/admin');
  return { message: decision === 'approve' ? 'Approved.' : 'Declined.' };
}

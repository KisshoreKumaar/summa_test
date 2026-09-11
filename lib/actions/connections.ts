'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/queries/session';

export interface ConnectionActionState {
  error?: string;
  message?: string;
}

async function requireUser() {
  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

function revalidateConnectionViews(profileId?: string) {
  revalidatePath('/connections');
  revalidatePath('/discover');
  revalidatePath('/dashboard');
  if (profileId) revalidatePath(`/profile/${profileId}`);
}

export async function sendConnectionRequest(
  _prev: ConnectionActionState,
  formData: FormData,
): Promise<ConnectionActionState> {
  const addresseeId = String(formData.get('addresseeId') ?? '');
  if (!addresseeId) return { error: 'Missing profile.' };

  const { supabase, user } = await requireUser();

  if (addresseeId === user.id) return { error: 'You cannot connect with yourself.' };

  const { error } = await supabase
    .from('connections')
    .insert({ requester_id: user.id, addressee_id: addresseeId });

  if (error) {
    // The unique pair index means "already exists in some direction".
    if (error.code === '23505') return { error: 'There is already a request between you.' };
    // 42501 = the RLS check refused it (inactive or not-yet-onboarded target).
    if (error.code === '42501') return { error: 'That person cannot receive requests.' };
    return { error: error.message };
  }

  revalidateConnectionViews(addresseeId);
  return { message: 'Request sent.' };
}

export async function respondToRequest(
  _prev: ConnectionActionState,
  formData: FormData,
): Promise<ConnectionActionState> {
  const connectionId = String(formData.get('connectionId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const profileId = String(formData.get('profileId') ?? '') || undefined;

  if (!connectionId) return { error: 'Missing request.' };
  if (decision !== 'accepted' && decision !== 'rejected') {
    return { error: 'Invalid response.' };
  }

  const { supabase } = await requireUser();

  /*
   * `.select()` matters here. RLS restricts this to the addressee of a
   * still-pending request, and a policy that filters every row is not an
   * error — PostgREST returns success with nothing changed. Without the
   * returned rows we would report "Connected." for a write that never
   * happened.
   */
  const { data, error } = await supabase
    .from('connections')
    .update({ status: decision })
    .eq('id', connectionId)
    .select('id');

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'That request is no longer pending.' };
  }

  revalidateConnectionViews(profileId);
  return { message: decision === 'accepted' ? 'Connected.' : 'Request declined.' };
}

/** Cancels a request you sent, or removes an existing connection. */
export async function removeConnection(
  _prev: ConnectionActionState,
  formData: FormData,
): Promise<ConnectionActionState> {
  const connectionId = String(formData.get('connectionId') ?? '');
  const profileId = String(formData.get('profileId') ?? '') || undefined;
  if (!connectionId) return { error: 'Missing connection.' };

  const { supabase } = await requireUser();

  // See respondToRequest: a delete filtered out by RLS reports success, so the
  // affected rows have to be checked explicitly.
  const { data, error } = await supabase
    .from('connections')
    .delete()
    .eq('id', connectionId)
    .select('id');

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'That connection could not be removed.' };
  }

  revalidateConnectionViews(profileId);
  return { message: 'Removed.' };
}

export async function markNotificationsRead(): Promise<void> {
  const { supabase, user } = await requireUser();

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  revalidatePath('/', 'layout');
}

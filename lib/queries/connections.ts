import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/queries/session';
import type { ConnectionState, ConnectionWithProfile } from '@/lib/types/database';

const PROFILE_FIELDS = 'id, full_name, avatar_url, year, branch, skills, interests';

/** Accepted connections for the signed-in user, newest first. */
export const getConnections = cache(async (): Promise<ConnectionWithProfile[]> => {
  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return [];

  const { data } = await supabase
    .from('connections')
    .select(
      `id, requester_id, addressee_id, status, created_at, updated_at,
       requester:profiles!connections_requester_id_fkey(${PROFILE_FIELDS}),
       addressee:profiles!connections_addressee_id_fkey(${PROFILE_FIELDS})`,
    )
    .eq('status', 'accepted')
    .order('updated_at', { ascending: false });

  return normalise(data, user.id);
});

/** Requests waiting on the signed-in user to accept or reject. */
export const getIncomingRequests = cache(async (): Promise<ConnectionWithProfile[]> => {
  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return [];

  const { data } = await supabase
    .from('connections')
    .select(
      `id, requester_id, addressee_id, status, created_at, updated_at,
       requester:profiles!connections_requester_id_fkey(${PROFILE_FIELDS}),
       addressee:profiles!connections_addressee_id_fkey(${PROFILE_FIELDS})`,
    )
    .eq('status', 'pending')
    .eq('addressee_id', user.id)
    .order('created_at', { ascending: false });

  return normalise(data, user.id);
});

/** Requests the signed-in user has sent and that are still pending. */
export const getSentRequests = cache(async (): Promise<ConnectionWithProfile[]> => {
  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return [];

  const { data } = await supabase
    .from('connections')
    .select(
      `id, requester_id, addressee_id, status, created_at, updated_at,
       requester:profiles!connections_requester_id_fkey(${PROFILE_FIELDS}),
       addressee:profiles!connections_addressee_id_fkey(${PROFILE_FIELDS})`,
    )
    .eq('status', 'pending')
    .eq('requester_id', user.id)
    .order('created_at', { ascending: false });

  return normalise(data, user.id);
});

/** The viewer's relationship with one profile, or null if there is none. */
export async function getConnectionState(targetId: string): Promise<ConnectionState | null> {
  const supabase = createClient();
  const { data } = await supabase.rpc('connection_state', { target: targetId });
  return data?.[0] ?? null;
}

export async function getMutualConnectionCount(targetId: string): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase.rpc('mutual_connection_count', { target: targetId });
  return typeof data === 'number' ? data : 0;
}

export const getPendingRequestCount = cache(async (): Promise<number> => {
  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return 0;

  const { count } = await supabase
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('addressee_id', user.id);

  return count ?? 0;
});

/**
 * Collapses the requester/addressee pair down to "the other person", so the UI
 * never has to care which side of the row the viewer sits on.
 */
type JoinedRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  requester: ConnectionWithProfile['profile'] | ConnectionWithProfile['profile'][] | null;
  addressee: ConnectionWithProfile['profile'] | ConnectionWithProfile['profile'][] | null;
};

function normalise(rows: unknown, viewerId: string): ConnectionWithProfile[] {
  if (!Array.isArray(rows)) return [];

  return (rows as JoinedRow[]).flatMap((row) => {
    const isRequester = row.requester_id === viewerId;
    const raw = isRequester ? row.addressee : row.requester;
    const profile = Array.isArray(raw) ? raw[0] : raw;
    if (!profile) return [];

    return [
      {
        id: row.id,
        requester_id: row.requester_id,
        addressee_id: row.addressee_id,
        status: row.status as ConnectionWithProfile['status'],
        created_at: row.created_at,
        updated_at: row.updated_at,
        profile,
      },
    ];
  });
}

import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  AdminStats,
  AdminUserRow,
  PendingGroupRequest,
  ReportQueueEntry,
  ReportStatus,
} from '@/lib/types/database';

/**
 * Every function here calls an RPC that re-checks the caller's role in SQL.
 * The route guard is convenience; these are the actual boundary.
 */
export const getAdminStats = cache(async (): Promise<AdminStats | null> => {
  const supabase = createClient();
  const { data } = await supabase.rpc('admin_stats');
  return ((data as AdminStats[]) ?? [])[0] ?? null;
});

export async function getReportQueue(
  status: ReportStatus = 'open',
): Promise<ReportQueueEntry[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc('admin_report_queue', {
    filter_status: status,
    page_limit: 100,
  });
  return (data as ReportQueueEntry[]) ?? [];
}

export const ADMIN_USER_PAGE_SIZE = 30;

export async function getAdminUsers(
  q: string,
  page = 0,
): Promise<{ users: AdminUserRow[]; hasMore: boolean }> {
  const supabase = createClient();
  const { data } = await supabase.rpc('admin_user_list', {
    q: q.trim() || null,
    page_limit: ADMIN_USER_PAGE_SIZE + 1,
    page_offset: page * ADMIN_USER_PAGE_SIZE,
  });

  const rows = (data as AdminUserRow[]) ?? [];
  return {
    users: rows.slice(0, ADMIN_USER_PAGE_SIZE),
    hasMore: rows.length > ADMIN_USER_PAGE_SIZE,
  };
}

export async function getPendingGroupRequests(): Promise<PendingGroupRequest[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc('admin_pending_group_requests');
  return (data as PendingGroupRequest[]) ?? [];
}

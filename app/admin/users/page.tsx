import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserTable } from '@/components/admin/user-table';
import { AdminUserSearch } from '@/components/admin/user-search';
import { ADMIN_USER_PAGE_SIZE, getAdminUsers } from '@/lib/queries/admin';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'User management' };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  // The RPC returns nothing for a club admin; keep them out of the page too.
  if (profile.role !== 'super_admin') redirect('/admin');

  const q = searchParams.q ?? '';
  const page = Math.max(0, Number(searchParams.page ?? 0) || 0);
  const { users, hasMore } = await getAdminUsers(q, page);

  const buildPage = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (target > 0) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `/admin/users?${qs}` : '/admin/users';
  };

  return (
    <div className="space-y-5">
      <AdminUserSearch initialQuery={q} />

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-600">
            {q ? `Nobody matches “${q}”.` : 'No users yet.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <UserTable users={users} viewerId={profile.id} />

          {(page > 0 || hasMore) && (
            <nav className="flex items-center justify-between border-t border-slate-200 pt-4">
              {page > 0 ? (
                <Link href={buildPage(page - 1)}>
                  <Button variant="outline" size="sm">
                    Previous
                  </Button>
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-slate-500">
                Showing {page * ADMIN_USER_PAGE_SIZE + 1}–
                {page * ADMIN_USER_PAGE_SIZE + users.length}
              </span>
              {hasMore ? (
                <Link href={buildPage(page + 1)}>
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

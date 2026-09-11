import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GroupCard } from '@/components/groups/group-card';
import { GroupFilters } from '@/components/groups/group-filters';
import { listGroups } from '@/lib/queries/groups';
import type { GroupCategory } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Groups' };

const CATEGORIES: GroupCategory[] = ['club', 'batch', 'project', 'interest'];

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; mine?: string };
}) {
  const category = CATEGORIES.includes(searchParams.category as GroupCategory)
    ? (searchParams.category as GroupCategory)
    : undefined;
  const mine = searchParams.mine === '1';
  const q = searchParams.q ?? '';

  const groups = await listGroups({ q, category, mine });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
          <p className="mt-1 text-sm text-slate-600">
            Clubs, project teams, and your batch — all in one place.
          </p>
        </div>
        <Link href="/groups/new">
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden />
            Create group
          </Button>
        </Link>
      </div>

      <GroupFilters initialQuery={q} category={category} mine={mine} />

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Users className="h-6 w-6 text-slate-400" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">No groups here yet</h2>
            <p className="mt-1 text-sm text-slate-600">
              {mine
                ? 'You have not joined any groups yet.'
                : 'Try a different filter, or create the first one.'}
            </p>
            <Link href="/groups/new" className="mt-4 inline-block">
              <Button size="sm" variant="outline">
                Create a group
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

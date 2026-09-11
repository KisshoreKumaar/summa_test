import type { Metadata } from 'next';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { SearchBar } from '@/components/discover/search-bar';
import { FilterPanel } from '@/components/discover/filter-panel';
import { ProfileCard } from '@/components/discover/profile-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getFilterFacets, searchProfiles, PAGE_SIZE } from '@/lib/queries/discover';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/queries/session';
import type { ConnectionState } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Discover' };

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const branches = toArray(searchParams.branch);
  const years = toArray(searchParams.year).map(Number).filter(Number.isFinite);
  const skills = toArray(searchParams.skill);
  const interests = toArray(searchParams.interest);
  const page = Math.max(0, Number(searchParams.page ?? 0) || 0);

  const [{ profiles, hasMore }, facets] = await Promise.all([
    searchProfiles({ q, branches, years, skills, interests, page }),
    getFilterFacets(),
  ]);

  const states = await getConnectionStates(profiles.map((p) => p.id));
  const hasFilters = Boolean(q || branches.length || years.length || skills.length || interests.length);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Discover</h1>
        <p className="mt-1 text-sm text-slate-600">
          Find students by name, skill, or interest.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <FilterPanel
            branches={facets.branches}
            selected={{ branches, years, skills, interests }}
          />
        </aside>

        <div className="space-y-5">
          <SearchBar initialQuery={q} />

          {profiles.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {profiles.map((person) => (
                  <ProfileCard
                    key={person.id}
                    person={person}
                    connectionState={states.get(person.id) ?? null}
                  />
                ))}
              </div>

              <Pagination
                page={page}
                hasMore={hasMore}
                searchParams={searchParams}
                count={profiles.length}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One round trip for every visible card's connection state, rather than an RPC
 * per card.
 */
async function getConnectionStates(ids: string[]): Promise<Map<string, ConnectionState>> {
  const map = new Map<string, ConnectionState>();
  if (ids.length === 0) return map;

  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return map;

  const { data } = await supabase
    .from('connections')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.in.(${ids.join(',')}),addressee_id.in.(${ids.join(',')})`);

  for (const row of data ?? []) {
    const other = row.requester_id === user.id ? row.addressee_id : row.requester_id;
    if (!ids.includes(other)) continue;
    map.set(other, {
      connection_id: row.id,
      status: row.status,
      direction: row.requester_id === user.id ? 'outgoing' : 'incoming',
    });
  }

  return map;
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Users className="h-6 w-6 text-slate-400" aria-hidden />
        </span>
        <h2 className="mt-4 font-semibold text-slate-900">
          {hasFilters ? 'No students match those filters' : 'No students to show yet'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {hasFilters
            ? 'Try removing a filter or searching for something broader.'
            : 'Once more students finish onboarding they will appear here.'}
        </p>
        {hasFilters && (
          <Link href="/discover" className="mt-4 inline-block">
            <Button variant="outline" size="sm">
              Clear filters
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function Pagination({
  page,
  hasMore,
  searchParams,
  count,
}: {
  page: number;
  hasMore: boolean;
  searchParams: Record<string, string | string[] | undefined>;
  count: number;
}) {
  if (page === 0 && !hasMore) return null;

  const build = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || value === undefined) continue;
      toArray(value).forEach((v) => params.append(key, v));
    }
    if (target > 0) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `/discover?${qs}` : '/discover';
  };

  return (
    <nav className="flex items-center justify-between border-t border-slate-200 pt-4">
      {page > 0 ? (
        <Link href={build(page - 1)}>
          <Button variant="outline" size="sm">
            Previous
          </Button>
        </Link>
      ) : (
        <span />
      )}

      <span className="text-sm text-slate-500">
        Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + count}
      </span>

      {hasMore ? (
        <Link href={build(page + 1)}>
          <Button variant="outline" size="sm">
            Next
          </Button>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap, Inbox, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MentorCard } from '@/components/mentorship/mentor-card';
import { MentorFilters } from '@/components/mentorship/mentor-filters';
import { SeekingToggle } from '@/components/mentorship/seeking-toggle';
import { MENTOR_PAGE_SIZE, searchMentors } from '@/lib/queries/mentorship';
import { getCurrentProfile } from '@/lib/queries/profile';
import { getMyMentorProfile } from '@/lib/queries/mentorship';

export const metadata: Metadata = { title: 'Mentorship' };

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function MentorshipPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const expertise = toArray(searchParams.expertise);
  const branches = toArray(searchParams.branch);
  const years = toArray(searchParams.year).map(Number).filter(Number.isFinite);
  const page = Math.max(0, Number(searchParams.page ?? 0) || 0);

  const [{ mentors, hasMore }, profile, myMentor] = await Promise.all([
    searchMentors({ q, expertise, branches, years, page }),
    getCurrentProfile(),
    getMyMentorProfile(),
  ]);

  const buildPage = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    expertise.forEach((e) => params.append('expertise', e));
    branches.forEach((b) => params.append('branch', b));
    years.forEach((y) => params.append('year', String(y)));
    if (target > 0) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `/mentorship?${qs}` : '/mentorship';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mentorship</h1>
          <p className="mt-1 text-sm text-slate-600">
            Find a senior student who can help, or offer to help someone else.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/mentorship/requests">
            <Button variant="outline" size="sm">
              <Inbox className="h-4 w-4" aria-hidden />
              Requests
            </Button>
          </Link>
          <Link href="/mentorship/me">
            <Button size="sm">
              {myMentor ? (
                <>
                  <Settings className="h-4 w-4" aria-hidden />
                  Mentor settings
                </>
              ) : (
                <>
                  <GraduationCap className="h-4 w-4" aria-hidden />
                  Become a mentor
                </>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {profile && <SeekingToggle seeking={profile.seeking_mentorship} />}

      <MentorFilters initialQuery={q} expertise={expertise} branches={branches} years={years} />

      {mentors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <GraduationCap className="h-6 w-6 text-slate-400" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">No mentors match</h2>
            <p className="mt-1 text-sm text-slate-600">
              Try a broader search, or put your own name forward.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mentors.map((mentor) => (
              <MentorCard key={mentor.user_id} mentor={mentor} />
            ))}
          </div>

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
                Showing {page * MENTOR_PAGE_SIZE + 1}–{page * MENTOR_PAGE_SIZE + mentors.length}
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

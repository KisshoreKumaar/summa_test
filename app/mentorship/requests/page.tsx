import type { Metadata } from 'next';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { RequestList } from '@/components/mentorship/request-list';
import {
  getIncomingMentorshipRequests,
  getOutgoingMentorshipRequests,
} from '@/lib/queries/mentorship';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mentorship requests' };

export default async function MentorshipRequestsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab === 'sent' ? 'sent' : 'received';

  const [incoming, outgoing] = await Promise.all([
    getIncomingMentorshipRequests(),
    getOutgoingMentorshipRequests(),
  ]);

  const rows = tab === 'received' ? incoming : outgoing;
  const counts = { received: incoming.length, sent: outgoing.length };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mentorship requests</h1>
        <p className="mt-1 text-sm text-slate-600">
          Requests you have received as a mentor, and the ones you have sent.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200" role="tablist">
        {(['received', 'sent'] as const).map((key) => (
          <Link
            key={key}
            href={key === 'received' ? '/mentorship/requests' : '/mentorship/requests?tab=sent'}
            role="tab"
            aria-selected={tab === key}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors',
              tab === key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
            )}
          >
            {key}
            {counts[key] > 0 && (
              <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {counts[key]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Inbox className="h-6 w-6 text-slate-400" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">
              {tab === 'received' ? 'No requests yet' : 'You have not asked anyone yet'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {tab === 'received'
                ? 'Join the mentor directory so students can find you.'
                : 'Browse the directory and reach out to a mentor.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <RequestList requests={rows} role={tab === 'received' ? 'mentor' : 'mentee'} />
      )}
    </div>
  );
}

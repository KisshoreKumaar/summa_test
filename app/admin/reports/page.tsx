import type { Metadata } from 'next';
import Link from 'next/link';
import { Flag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ReportQueue } from '@/components/admin/report-queue';
import { getReportQueue } from '@/lib/queries/admin';
import { cn } from '@/lib/utils';
import type { ReportStatus } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Moderation queue' };

const TABS: ReportStatus[] = ['open', 'resolved', 'dismissed'];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = TABS.includes(searchParams.status as ReportStatus)
    ? (searchParams.status as ReportStatus)
    : 'open';

  const reports = await getReportQueue(status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={tab === 'open' ? '/admin/reports' : `/admin/reports?status=${tab}`}
            className={cn(
              'rounded-full border px-3 py-1 text-xs capitalize transition-colors',
              status === tab
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300',
            )}
          >
            {tab}
          </Link>
        ))}
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Flag className="h-6 w-6 text-slate-400" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">
              {status === 'open' ? 'Nothing to review' : `No ${status} reports`}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {status === 'open'
                ? 'Reported posts, messages, and profiles will appear here.'
                : 'Reports you have actioned show up under this tab.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ReportQueue reports={reports} readOnly={status !== 'open'} />
      )}
    </div>
  );
}

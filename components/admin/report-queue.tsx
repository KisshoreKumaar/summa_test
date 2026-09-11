'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { FileText, MessageSquare, Trash2, User, X } from 'lucide-react';
import { resolveReportAction, type AdminActionState } from '@/lib/actions/admin';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ReportQueueEntry, ReportTargetType } from '@/lib/types/database';

const initialState: AdminActionState = {};

const TARGET: Record<ReportTargetType, { Icon: typeof FileText; label: string }> = {
  post: { Icon: FileText, label: 'Group post' },
  message: { Icon: MessageSquare, label: 'Message' },
  user: { Icon: User, label: 'Profile' },
};

export function ReportQueue({
  reports,
  readOnly,
}: {
  reports: ReportQueueEntry[];
  readOnly: boolean;
}) {
  const [state, resolve] = useFormState(resolveReportAction, initialState);

  return (
    <div className="space-y-3">
      {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      {reports.map((report) => {
        const { Icon, label } = TARGET[report.target_type];

        return (
          <Card key={report.id}>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="slate">
                      <Icon className="mr-1 h-3 w-3" aria-hidden />
                      {label}
                    </Badge>
                    {!report.target_exists && <Badge tone="amber">Already gone</Badge>}
                    <span className="text-xs text-slate-500">
                      reported by{' '}
                      <Link
                        href={`/profile/${report.reporter_id}`}
                        className="hover:text-brand-600"
                      >
                        {report.reporter_name ?? 'a student'}
                      </Link>
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-900">{report.reason}</p>

                  {report.target_preview && (
                    <blockquote className="mt-2 border-l-2 border-slate-200 pl-3 text-sm text-slate-600">
                      {report.target_preview}
                    </blockquote>
                  )}

                  {report.target_author && (
                    <Link
                      href={`/profile/${report.target_author}`}
                      className="mt-2 inline-block text-xs text-brand-600 hover:text-brand-700"
                    >
                      View the author&rsquo;s profile
                    </Link>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {report.target_type !== 'user' && report.target_exists && (
                      <form action={resolve}>
                        <input type="hidden" name="reportId" value={report.id} />
                        <input type="hidden" name="action" value="remove" />
                        <Button type="submit" size="sm" variant="danger">
                          <Trash2 className="h-4 w-4" aria-hidden />
                          Remove
                        </Button>
                      </form>
                    )}
                    <form action={resolve}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <input type="hidden" name="action" value="resolve" />
                      <Button type="submit" size="sm" variant="outline">
                        Mark handled
                      </Button>
                    </form>
                    <form action={resolve}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <input type="hidden" name="action" value="dismiss" />
                      <Button type="submit" size="sm" variant="ghost">
                        <X className="h-4 w-4" aria-hidden />
                        Dismiss
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

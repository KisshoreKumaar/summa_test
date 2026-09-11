import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConnectionList } from '@/components/connections/connection-list';
import { cn } from '@/lib/utils';
import {
  getConnections,
  getIncomingRequests,
  getSentRequests,
} from '@/lib/queries/connections';

export const metadata: Metadata = { title: 'Connections' };

const TABS = [
  { key: 'all', label: 'Connections' },
  { key: 'requests', label: 'Requests' },
  { key: 'sent', label: 'Sent' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string };
}) {
  const tab: TabKey = TABS.some((t) => t.key === searchParams.tab)
    ? (searchParams.tab as TabKey)
    : 'all';

  const [connections, incoming, sent] = await Promise.all([
    getConnections(),
    getIncomingRequests(),
    getSentRequests(),
  ]);

  const counts = { all: connections.length, requests: incoming.length, sent: sent.length };
  const rows = tab === 'all' ? connections : tab === 'requests' ? incoming : sent;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Connections</h1>
          <p className="mt-1 text-sm text-slate-600">
            People you are connected with, and requests waiting on a decision.
          </p>
        </div>
        <Link href="/discover">
          <Button size="sm">
            <UserPlus className="h-4 w-4" aria-hidden />
            Find people
          </Button>
        </Link>
      </div>

      <div className="flex gap-1 border-b border-slate-200" role="tablist">
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <Link
              key={key}
              href={key === 'all' ? '/connections' : `/connections?tab=${key}`}
              role="tab"
              aria-selected={active}
              className={cn(
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
              )}
            >
              {label}
              {counts[key] > 0 && (
                <span
                  className={cn(
                    'ml-2 rounded-full px-1.5 py-0.5 text-xs',
                    active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {counts[key]}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="font-semibold text-slate-900">
              {tab === 'all'
                ? 'No connections yet'
                : tab === 'requests'
                  ? 'No pending requests'
                  : 'No sent requests'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {tab === 'all'
                ? 'Head to Discover and send your first connection request.'
                : tab === 'requests'
                  ? 'When someone asks to connect, it will show up here.'
                  : 'Requests you send will stay here until they are answered.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ConnectionList rows={rows} variant={tab} />
      )}
    </div>
  );
}

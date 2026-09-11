import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { GroupRequestQueue } from '@/components/admin/group-request-queue';
import { getPendingGroupRequests } from '@/lib/queries/admin';

export const metadata: Metadata = { title: 'Group requests' };

export default async function AdminGroupsPage() {
  const requests = await getPendingGroupRequests();

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        People waiting to join a private group you administer.{' '}
        <Link href="/groups" className="text-brand-600 hover:text-brand-700">
          Browse all groups
        </Link>
      </p>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <ShieldCheck className="h-6 w-6 text-slate-400" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">Nothing waiting</h2>
            <p className="mt-1 text-sm text-slate-600">
              Join requests for private groups will collect here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <GroupRequestQueue requests={requests} />
      )}
    </div>
  );
}

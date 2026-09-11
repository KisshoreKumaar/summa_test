import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, Flag, LayoutGrid, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getAdminStats } from '@/lib/queries/admin';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminOverviewPage() {
  const stats = await getAdminStats();

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-600">
          Statistics are unavailable.
        </CardContent>
      </Card>
    );
  }

  const cards = [
    { label: 'Open reports', value: stats.open_reports, Icon: Flag, href: '/admin/reports', urgent: stats.open_reports > 0 },
    { label: 'Pending group requests', value: stats.pending_groups, Icon: ShieldCheck, href: '/admin/groups', urgent: stats.pending_groups > 0 },
    { label: 'Total users', value: stats.total_users, Icon: Users, href: '/admin/users' },
    { label: 'Active users', value: stats.active_users, Icon: UserCheck, href: '/admin/users' },
    { label: 'Onboarded', value: stats.onboarded_users, Icon: UserCheck },
    { label: 'Groups', value: stats.total_groups, Icon: LayoutGrid, href: '/groups' },
    { label: 'Events', value: stats.total_events, Icon: CalendarDays, href: '/events' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ label, value, Icon, href, urgent }) => {
        const body = (
          <Card className={urgent ? 'border-brand-200 bg-brand-50/40' : undefined}>
            <CardContent className="flex items-center gap-4 py-5">
              <span
                className={
                  urgent
                    ? 'flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700'
                    : 'flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500'
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
                <p className="text-sm text-slate-600">{label}</p>
              </div>
            </CardContent>
          </Card>
        );

        return href ? (
          <Link key={label} href={href} className="block transition-shadow hover:shadow-md">
            {body}
          </Link>
        ) : (
          <div key={label}>{body}</div>
        );
      })}
    </div>
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AnnouncementComposer } from '@/components/events/announcement-composer';
import { AnnouncementCard } from '@/components/events/announcement-card';
import { listAnnouncements } from '@/lib/queries/events';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'Announcements' };

export default async function AnnouncementsPage() {
  const [announcements, profile] = await Promise.all([
    listAnnouncements(),
    getCurrentProfile(),
  ]);

  if (!profile) redirect('/login');

  const canPublish = profile.role === 'club_admin' || profile.role === 'super_admin';
  const pinned = announcements.filter((a) => a.pinned);
  const rest = announcements.filter((a) => !a.pinned);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        <p className="mt-1 text-sm text-slate-600">
          Department-wide notices. Only admins can post here.
        </p>
      </div>

      {canPublish && <AnnouncementComposer />}

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Megaphone className="h-6 w-6 text-slate-400" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">Nothing announced yet</h2>
            <p className="mt-1 text-sm text-slate-600">
              Department notices will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pinned
              </h2>
              <div className="space-y-3">
                {pinned.map((a) => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    canManage={
                      profile.role === 'super_admin' ||
                      (canPublish && a.created_by === profile.id)
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              {pinned.length > 0 && (
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Earlier
                </h2>
              )}
              <div className="space-y-3">
                {rest.map((a) => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    canManage={
                      profile.role === 'super_admin' ||
                      (canPublish && a.created_by === profile.id)
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';
import { CalendarClock, GraduationCap } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { yearLabel } from '@/lib/utils';
import type { MentorDirectoryEntry } from '@/lib/types/database';

export function MentorCard({ mentor }: { mentor: MentorDirectoryEntry }) {
  const subtitle = [yearLabel(mentor.year), mentor.branch].filter(Boolean).join(' · ');

  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col py-5">
        <div className="flex items-start gap-3">
          <Link href={`/mentorship/${mentor.user_id}`} className="shrink-0">
            <Avatar src={mentor.avatar_url} name={mentor.full_name} size="lg" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/mentorship/${mentor.user_id}`}
              className="block truncate font-semibold text-slate-900 hover:text-brand-600"
            >
              {mentor.full_name ?? 'Unnamed mentor'}
            </Link>
            {subtitle && <p className="mt-0.5 truncate text-sm text-slate-600">{subtitle}</p>}
            {mentor.is_connected && (
              <p className="mt-1 text-xs text-emerald-700">You are connected</p>
            )}
          </div>
        </div>

        {mentor.bio && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{mentor.bio}</p>}

        {mentor.expertise.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mentor.expertise.slice(0, 4).map((tag) => (
              <Badge key={tag} tone="brand" className="text-[11px]">
                {tag}
              </Badge>
            ))}
            {mentor.expertise.length > 4 && (
              <span className="text-xs text-slate-400">+{mentor.expertise.length - 4}</span>
            )}
          </div>
        )}

        <div className="mt-4 flex-1" />

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            {mentor.open_slots > 0
              ? `${mentor.open_slots} open slot${mentor.open_slots === 1 ? '' : 's'}`
              : 'No slots yet'}
          </span>
          <Link
            href={`/mentorship/${mentor.user_id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <GraduationCap className="h-4 w-4" aria-hidden />
            View
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

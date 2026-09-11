import Link from 'next/link';
import { Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ConnectionButton } from '@/components/connections/connection-button';
import { yearLabel } from '@/lib/utils';
import type { ConnectionState } from '@/lib/types/database';

export interface ProfileCardPerson {
  id: string;
  full_name: string | null;
  year: number | null;
  branch: string | null;
  bio: string | null;
  avatar_url: string | null;
  skills: string[];
  interests: string[];
}

export function ProfileCard({
  person,
  connectionState,
  mutualConnections,
  matchReason,
}: {
  person: ProfileCardPerson;
  connectionState: ConnectionState | null;
  mutualConnections?: number;
  matchReason?: string;
}) {
  const subtitle = [yearLabel(person.year), person.branch].filter(Boolean).join(' · ');
  const tags = [...person.skills.slice(0, 3), ...person.interests.slice(0, 2)];

  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col py-5">
        <div className="flex items-start gap-3">
          <Link href={`/profile/${person.id}`} className="shrink-0">
            <Avatar src={person.avatar_url} name={person.full_name} size="lg" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/profile/${person.id}`}
              className="block truncate font-semibold text-slate-900 hover:text-brand-600"
            >
              {person.full_name ?? 'Unnamed student'}
            </Link>
            {subtitle && <p className="mt-0.5 truncate text-sm text-slate-600">{subtitle}</p>}
            {typeof mutualConnections === 'number' && mutualConnections > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Users className="h-3 w-3" aria-hidden />
                {mutualConnections} mutual connection{mutualConnections === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>

        {person.bio && (
          <p className="mt-3 line-clamp-2 text-sm text-slate-600">{person.bio}</p>
        )}

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} tone="slate" className="text-[11px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {matchReason && <p className="mt-3 text-xs text-brand-700">{matchReason}</p>}

        <div className="mt-4 flex-1" />

        <ConnectionButton profileId={person.id} state={connectionState} />
      </CardContent>
    </Card>
  );
}

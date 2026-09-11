import Link from 'next/link';
import { Lock, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { GroupCategory, GroupWithMembership } from '@/lib/types/database';

export const CATEGORY_LABEL: Record<GroupCategory, string> = {
  club: 'Club',
  batch: 'Batch',
  project: 'Project',
  interest: 'Interest',
};

export function GroupCard({ group }: { group: GroupWithMembership }) {
  const isMember = group.viewer_status === 'active';
  const isPending = group.viewer_status === 'pending';

  return (
    <Link href={`/groups/${group.id}`} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
        <div
          className={cn(
            'h-20 bg-gradient-to-br',
            group.category === 'batch'
              ? 'from-emerald-400 to-emerald-600'
              : group.category === 'club'
                ? 'from-brand-400 to-brand-600'
                : group.category === 'project'
                  ? 'from-amber-400 to-amber-600'
                  : 'from-slate-400 to-slate-600',
          )}
          style={
            group.cover_url
              ? { backgroundImage: `url(${group.cover_url})`, backgroundSize: 'cover' }
              : undefined
          }
        />

        <CardContent className="flex flex-1 flex-col py-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate font-semibold text-slate-900 group-hover:text-brand-600">
              {group.name}
            </h3>
            {group.type === 'private' && (
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="Private" />
            )}
          </div>

          {group.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{group.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={group.category === 'batch' ? 'green' : 'slate'}>
              {CATEGORY_LABEL[group.category]}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Users className="h-3 w-3" aria-hidden />
              {group.member_count}
            </span>
            {isMember && <Badge tone="brand">Joined</Badge>}
            {isPending && <Badge tone="amber">Pending</Badge>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

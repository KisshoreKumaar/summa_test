import { Lock } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ConnectionButton } from '@/components/connections/connection-button';
import { yearLabel } from '@/lib/utils';
import type { ConnectionState, ProfilePreview } from '@/lib/types/database';

const REASON: Record<ProfilePreview['visibility'], string> = {
  public: 'This profile is not fully visible to you.',
  department: 'This student shares their full profile with their own department only.',
  connections: 'This student shares their full profile with their connections only.',
};

/**
 * Shown when the viewer may not read the full row. Enough to identify the
 * person and send a request, nothing more.
 */
export function LimitedProfile({
  preview,
  connectionState,
  mutualConnections,
}: {
  preview: ProfilePreview;
  connectionState: ConnectionState | null;
  mutualConnections: number;
}) {
  const subtitle = [yearLabel(preview.year), preview.branch].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardContent className="py-8 text-center">
          <Avatar
            src={preview.avatar_url}
            name={preview.full_name}
            size="2xl"
            className="mx-auto"
          />

          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {preview.full_name ?? 'Unnamed student'}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}

          {mutualConnections > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              {mutualConnections} mutual connection{mutualConnections === 1 ? '' : 's'}
            </p>
          )}

          <div className="mt-6 flex justify-center">
            <ConnectionButton profileId={preview.id} state={connectionState} size="md" />
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-sm text-slate-500">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            <span>{REASON[preview.visibility]}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

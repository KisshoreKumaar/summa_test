import Link from 'next/link';
import { Github, Globe, Linkedin, Mail, Pencil, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConnectionButton } from '@/components/connections/connection-button';
import { StartDirectMessage } from '@/components/messages/start-conversation-button';
import { ReportButton } from '@/components/admin/report-button';
import { yearLabel } from '@/lib/utils';
import type { ConnectionState, Profile } from '@/lib/types/database';

const VISIBILITY_LABEL: Record<Profile['visibility'], string> = {
  public: 'Visible to everyone',
  department: 'Visible to your department',
  connections: 'Visible to connections',
};

export function ProfileHeader({
  profile,
  isOwner,
  connectionState = null,
  mutualConnections = 0,
}: {
  profile: Profile;
  isOwner: boolean;
  connectionState?: ConnectionState | null;
  mutualConnections?: number;
}) {
  const links = [
    { href: profile.github_url, Icon: Github, label: 'GitHub' },
    { href: profile.linkedin_url, Icon: Linkedin, label: 'LinkedIn' },
    { href: profile.portfolio_url, Icon: Globe, label: 'Portfolio' },
  ].filter((l): l is { href: string; Icon: typeof Github; label: string } => !!l.href);

  const subtitle = [yearLabel(profile.year), profile.branch].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <Avatar src={profile.avatar_url} name={profile.full_name} size="2xl" className="mx-auto sm:mx-0" />

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-slate-900">
              {profile.full_name ?? 'Unnamed student'}
            </h1>
            {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
            {!isOwner && mutualConnections > 0 && (
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-slate-500 sm:justify-start">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {mutualConnections} mutual connection{mutualConnections === 1 ? '' : 's'}
              </p>
            )}
            {profile.role !== 'student' && (
              <Badge tone="brand" className="mt-2">
                {profile.role === 'super_admin' ? 'Admin' : 'Club admin'}
              </Badge>
            )}
          </div>

          {isOwner ? (
            <Link href="/profile/edit">
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" aria-hidden />
                Edit profile
              </Button>
            </Link>
          ) : (
            <div className="flex flex-wrap items-start gap-2">
              {/* DMs are only possible between connections. */}
              {connectionState?.status === 'accepted' && (
                <StartDirectMessage userId={profile.id} />
              )}
              <ConnectionButton profileId={profile.id} state={connectionState} />
              <ReportButton targetType="user" targetId={profile.id} compact label="Report profile" />
            </div>
          )}
        </div>

        {profile.bio && (
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {profile.bio}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
          {links.map(({ href, Icon, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 transition-colors hover:text-brand-600"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </a>
          ))}
          {isOwner && (
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Mail className="h-4 w-4" aria-hidden />
              {profile.email}
            </span>
          )}
        </div>

        {isOwner && (
          <p className="mt-3 text-xs text-slate-400">{VISIBILITY_LABEL[profile.visibility]}</p>
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConnectionButton } from '@/components/connections/connection-button';
import { yearLabel } from '@/lib/utils';
import type { ConnectionWithProfile } from '@/lib/types/database';

export function ConnectionList({
  rows,
  variant,
}: {
  rows: ConnectionWithProfile[];
  variant: 'all' | 'requests' | 'sent';
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter(({ profile }) => {
      const haystack = [
        profile.full_name ?? '',
        profile.branch ?? '',
        ...(profile.skills ?? []),
        ...(profile.interests ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search this list…"
        aria-label="Search connections"
        leftIcon={<Search className="h-4 w-4" />}
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          Nobody in this list matches “{query}”.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => {
            const { profile } = row;
            const subtitle = [yearLabel(profile.year), profile.branch].filter(Boolean).join(' · ');

            return (
              <li key={row.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-4 py-4">
                    <Link href={`/profile/${profile.id}`} className="shrink-0">
                      <Avatar src={profile.avatar_url} name={profile.full_name} size="md" />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/profile/${profile.id}`}
                        className="block truncate font-medium text-slate-900 hover:text-brand-600"
                      >
                        {profile.full_name ?? 'Unnamed student'}
                      </Link>
                      {subtitle && <p className="truncate text-sm text-slate-600">{subtitle}</p>}
                      {profile.skills?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {profile.skills.slice(0, 3).map((skill) => (
                            <Badge key={skill} tone="slate" className="text-[11px]">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <ConnectionButton
                      profileId={profile.id}
                      state={{
                        connection_id: row.id,
                        status: row.status,
                        direction: variant === 'requests' ? 'incoming' : 'outgoing',
                      }}
                    />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

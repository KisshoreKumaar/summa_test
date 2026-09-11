import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileHeader } from '@/components/profile/profile-header';
import { LimitedProfile } from '@/components/profile/limited-profile';
import { TagList } from '@/components/profile/tag-list';
import { CompletenessCard } from '@/components/profile/completeness-card';
import { getCurrentProfile, getProfileById, getProfilePreview } from '@/lib/queries/profile';
import { getConnectionState, getMutualConnectionCount } from '@/lib/queries/connections';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const profile = await getProfileById(params.id);
  if (profile) return { title: profile.full_name ?? 'Profile' };

  const preview = await getProfilePreview(params.id);
  return { title: preview?.full_name ?? 'Profile' };
}

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const [profile, viewer] = await Promise.all([getProfileById(params.id), getCurrentProfile()]);

  /*
   * RLS hid the full row. Fall back to the limited preview so the viewer can
   * still identify the person and send a connection request; only a profile
   * that does not exist (or is deactivated) 404s.
   */
  if (!profile) {
    const preview = await getProfilePreview(params.id);
    if (!preview || preview.id === viewer?.id) notFound();

    const [connectionState, mutualConnections] = await Promise.all([
      getConnectionState(preview.id),
      getMutualConnectionCount(preview.id),
    ]);

    return (
      <LimitedProfile
        preview={preview}
        connectionState={connectionState}
        mutualConnections={mutualConnections}
      />
    );
  }

  const isOwner = viewer?.id === profile.id;

  // Only meaningful when looking at somebody else.
  const [connectionState, mutualConnections] = isOwner
    ? [null, 0]
    : await Promise.all([getConnectionState(profile.id), getMutualConnectionCount(profile.id)]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardContent className="py-6">
            <ProfileHeader
              profile={profile}
              isOwner={isOwner}
              connectionState={connectionState}
              mutualConnections={mutualConnections}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-6 py-6">
            <TagList
              title="Skills"
              tags={profile.skills}
              emptyText={isOwner ? 'Add skills so peers can find you.' : 'No skills listed yet.'}
            />
            <TagList
              title="Interests"
              tags={profile.interests}
              tone="slate"
              emptyText={isOwner ? 'Add interests to get better suggestions.' : 'No interests listed yet.'}
            />
          </CardContent>
        </Card>
      </div>

      {isOwner && <CompletenessCard profile={profile} />}
    </div>
  );
}

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Lock, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { JoinButton } from '@/components/groups/join-button';
import { OpenGroupChat } from '@/components/messages/start-conversation-button';
import { CATEGORY_LABEL } from '@/components/groups/group-card';
import { PostComposer } from '@/components/groups/post-composer';
import { PostCard } from '@/components/groups/post-card';
import { MemberList, PendingRequests } from '@/components/groups/member-list';
import { getCurrentProfile } from '@/lib/queries/profile';
import {
  getGroup,
  getGroupFeed,
  getGroupMembers,
  getPendingMembers,
  getPostComments,
} from '@/lib/queries/groups';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const group = await getGroup(params.id);
  return { title: group?.name ?? 'Group' };
}

export default async function GroupPage({ params }: { params: { id: string } }) {
  const [group, viewer] = await Promise.all([getGroup(params.id), getCurrentProfile()]);

  if (!group) notFound();
  if (!viewer) redirect('/login');

  const isMember = group.viewer_status === 'active';
  const isOwner = isMember && group.viewer_role === 'owner';
  const canManage = isMember && (group.viewer_role === 'owner' || group.viewer_role === 'admin');

  const [members, pending, posts] = await Promise.all([
    isMember ? getGroupMembers(group.id) : Promise.resolve([]),
    canManage ? getPendingMembers(group.id) : Promise.resolve([]),
    isMember ? getGroupFeed(group.id) : Promise.resolve([]),
  ]);

  // One query per post is acceptable at this scale; revisit if feeds grow.
  const commentsByPost = new Map(
    await Promise.all(
      posts.map(async (post) => [post.id, await getPostComments(post.id)] as const),
    ),
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div
          className="h-28 bg-gradient-to-br from-brand-400 to-brand-600"
          style={
            group.cover_url
              ? { backgroundImage: `url(${group.cover_url})`, backgroundSize: 'cover' }
              : undefined
          }
        />
        <CardContent className="py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{group.name}</h1>
                {group.type === 'private' && (
                  <Badge tone="slate">
                    <Lock className="mr-1 h-3 w-3" aria-hidden />
                    Private
                  </Badge>
                )}
                <Badge tone={group.category === 'batch' ? 'green' : 'brand'}>
                  {CATEGORY_LABEL[group.category]}
                </Badge>
              </div>

              {group.description && (
                <p className="mt-2 max-w-2xl text-sm text-slate-600">{group.description}</p>
              )}

              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                <Users className="h-4 w-4" aria-hidden />
                {group.member_count} member{group.member_count === 1 ? '' : 's'}
              </p>
            </div>

            <div className="flex flex-wrap items-start gap-2">
              {isMember && <OpenGroupChat groupId={group.id} size="md" />}
              <JoinButton group={group} />
            </div>
          </div>
        </CardContent>
      </Card>

      {!isMember ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Lock className="h-6 w-6 text-slate-400" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">
              {group.viewer_status === 'pending'
                ? 'Your request is awaiting approval'
                : 'Members only'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {group.viewer_status === 'pending'
                ? 'An admin will review it shortly. You will get a notification.'
                : 'Join this group to see its posts and members.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-4">
            <PostComposer
              groupId={group.id}
              authorName={viewer.full_name}
              authorAvatar={viewer.avatar_url}
            />

            {posts.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <h2 className="font-semibold text-slate-900">No posts yet</h2>
                  <p className="mt-1 text-sm text-slate-600">Be the first to say something.</p>
                </CardContent>
              </Card>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  comments={commentsByPost.get(post.id) ?? []}
                  groupId={group.id}
                  viewerId={viewer.id}
                  canModerate={canManage}
                />
              ))
            )}
          </div>

          <aside className="space-y-4">
            {canManage && <PendingRequests groupId={group.id} requests={pending} />}
            <MemberList
              groupId={group.id}
              members={members}
              canManage={canManage}
              isOwner={isOwner}
              viewerId={viewer.id}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

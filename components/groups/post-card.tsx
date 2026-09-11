'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Heart, MessageCircle, Trash2 } from 'lucide-react';
import {
  addCommentAction,
  deleteCommentAction,
  deletePostAction,
  toggleLikeAction,
  type GroupActionState,
} from '@/lib/actions/groups';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ReportButton } from '@/components/admin/report-button';
import { cn } from '@/lib/utils';
import type { GroupPostWithMeta, ProfileSummary } from '@/lib/types/database';

const initialState: GroupActionState = {};

export interface PostComment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: ProfileSummary | null;
}

function relativeTime(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function CommentSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" loading={pending}>
      Reply
    </Button>
  );
}

export function PostCard({
  post,
  comments,
  groupId,
  viewerId,
  canModerate,
}: {
  post: GroupPostWithMeta;
  comments: PostComment[];
  groupId: string;
  viewerId: string;
  canModerate: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentState, addComment] = useFormState(addCommentAction, initialState);
  const [deleteState, deletePost] = useFormState(deletePostAction, initialState);

  const canDelete = canModerate || post.author_id === viewerId;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <Link href={`/profile/${post.author_id}`} className="shrink-0">
            <Avatar src={post.author?.avatar_url} name={post.author?.full_name} size="md" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <Link
                href={`/profile/${post.author_id}`}
                className="truncate font-medium text-slate-900 hover:text-brand-600"
              >
                {post.author?.full_name ?? 'Unnamed student'}
              </Link>
              <span className="text-xs text-slate-500">{relativeTime(post.created_at)}</span>
            </div>

            <p className="mt-1.5 whitespace-pre-line text-sm text-slate-800">{post.content}</p>

            <div className="mt-3 flex items-center gap-1">
              <form action={toggleLikeAction}>
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="groupId" value={groupId} />
                <input type="hidden" name="liked" value={String(post.liked_by_viewer)} />
                <button
                  type="submit"
                  aria-pressed={post.liked_by_viewer}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors',
                    post.liked_by_viewer
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-500 hover:bg-slate-100',
                  )}
                >
                  <Heart
                    className={cn('h-4 w-4', post.liked_by_viewer && 'fill-current')}
                    aria-hidden
                  />
                  {post.like_count > 0 && post.like_count}
                  <span className="sr-only">{post.liked_by_viewer ? 'Unlike' : 'Like'}</span>
                </button>
              </form>

              <button
                type="button"
                onClick={() => setShowComments((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-100"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {post.comment_count > 0 && post.comment_count}
                <span className="sr-only">Comments</span>
              </button>

              <div className="ml-auto flex items-center gap-1">
                {post.author_id !== viewerId && (
                  <ReportButton targetType="post" targetId={post.id} compact />
                )}
              {canDelete && (
                <form action={deletePost}>
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="groupId" value={groupId} />
                  <button
                    type="submit"
                    aria-label="Delete post"
                    className="rounded-lg px-2 py-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              )}
              </div>
            </div>

            {deleteState.errors?._form && (
              <p className="mt-1 text-xs text-red-600">{deleteState.errors._form}</p>
            )}

            {showComments && (
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <Avatar
                      src={comment.author?.avatar_url}
                      name={comment.author?.full_name}
                      size="xs"
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-xs font-medium text-slate-900">
                          {comment.author?.full_name ?? 'Unnamed student'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {relativeTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-700">{comment.content}</p>
                    </div>
                    {(canModerate || comment.author_id === viewerId) && (
                      <form action={deleteCommentAction}>
                        <input type="hidden" name="commentId" value={comment.id} />
                        <input type="hidden" name="groupId" value={groupId} />
                        <button
                          type="submit"
                          aria-label="Delete comment"
                          className="rounded p-1 text-slate-300 transition-colors hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </form>
                    )}
                  </div>
                ))}

                <form action={addComment} className="flex items-center gap-2">
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="groupId" value={groupId} />
                  <Input
                    name="content"
                    placeholder="Write a comment…"
                    aria-label="Write a comment"
                    error={commentState.errors?.content}
                    required
                  />
                  <CommentSubmit />
                </form>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

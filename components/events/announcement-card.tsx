'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';
import {
  deleteAnnouncementAction,
  togglePinAction,
  updateAnnouncementAction,
  type EventActionState,
} from '@/lib/actions/events';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AnnouncementWithAuthor } from '@/lib/types/database';

const initialState: EventActionState = {};

export function AnnouncementCard({
  announcement,
  canManage,
}: {
  announcement: AnnouncementWithAuthor;
  canManage: boolean;
}) {
  const [pinState, togglePin] = useFormState(togglePinAction, initialState);
  const [deleteState, remove] = useFormState(deleteAnnouncementAction, initialState);
  const [editState, save] = useFormState(updateAnnouncementAction, initialState);
  const [editing, setEditing] = useState(false);

  const error = pinState.errors?._form ?? deleteState.errors?._form ?? editState.errors?._form;

  const posted = new Date(announcement.created_at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (editing) {
    return (
      <Card className="border-brand-200">
        <CardContent className="py-5">
          <form
            action={async (formData) => {
              await save(formData);
              setEditing(false);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="announcementId" value={announcement.id} />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Input
              name="title"
              label="Title"
              defaultValue={announcement.title}
              error={editState.errors?.title}
              required
            />
            <Textarea
              name="content"
              label="Content"
              rows={4}
              defaultValue={announcement.content}
              maxLengthCounter={5000}
              error={editState.errors?.content}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="pinned"
                  defaultChecked={announcement.pinned}
                  className="h-4 w-4 accent-brand-600"
                />
                Pinned
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  <X className="h-4 w-4" aria-hidden />
                  Cancel
                </Button>
                <SaveButton />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(announcement.pinned && 'border-brand-200 bg-brand-50/30')}>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900">{announcement.title}</h3>
              {announcement.pinned && (
                <Badge tone="brand">
                  <Pin className="mr-1 h-3 w-3" aria-hidden />
                  Pinned
                </Badge>
              )}
            </div>

            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {announcement.content}
            </p>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              {announcement.author && (
                <>
                  <Avatar
                    src={announcement.author.avatar_url}
                    name={announcement.author.full_name}
                    size="xs"
                  />
                  <Link
                    href={`/profile/${announcement.author.id}`}
                    className="hover:text-brand-600"
                  >
                    {announcement.author.full_name ?? 'Admin'}
                  </Link>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>{posted}</span>
            </div>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          {canManage && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit announcement"
                title="Edit"
                className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <form action={togglePin}>
                <input type="hidden" name="announcementId" value={announcement.id} />
                <input type="hidden" name="pinned" value={String(announcement.pinned)} />
                <button
                  type="submit"
                  aria-label={announcement.pinned ? 'Unpin' : 'Pin to top'}
                  title={announcement.pinned ? 'Unpin' : 'Pin to top'}
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
                >
                  {announcement.pinned ? (
                    <PinOff className="h-4 w-4" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )}
                </button>
              </form>
              <form action={remove}>
                <input type="hidden" name="announcementId" value={announcement.id} />
                <button
                  type="submit"
                  aria-label="Delete announcement"
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Save
    </Button>
  );
}

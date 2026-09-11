'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fieldErrors } from '@/lib/validation';

export interface EventActionState {
  errors?: Record<string, string>;
  message?: string;
}

const eventSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(140),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be 2000 characters or fewer')
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  start_time: z
    .string()
    .min(1, 'Pick a date and time')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date and time'),
  end_time: z
    .string()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'Enter a valid end time'),
  location: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  category: z.enum(['workshop', 'talk', 'competition', 'social', 'sports', 'cultural', 'other']),
  cover_url: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
});

const announcementSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(140),
  content: z.string().trim().min(1, 'Write something').max(5000),
  pinned: z.boolean(),
});

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

function readEventForm(formData: FormData) {
  return {
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    start_time: formData.get('start_time') ?? '',
    end_time: formData.get('end_time') ?? '',
    location: formData.get('location') ?? '',
    category: formData.get('category') ?? 'other',
    cover_url: formData.get('cover_url') ?? '',
  };
}

export async function createEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const parsed = eventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (parsed.data.end_time && parsed.data.end_time < parsed.data.start_time) {
    return { errors: { end_time: 'The end time cannot be before the start time.' } };
  }

  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from('events')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id')
    .single();

  if (error || !data) {
    // The insert policy refuses anyone who is not an admin.
    if (error?.code === '42501') {
      return { errors: { _form: 'Only admins and club admins can create events.' } };
    }
    return { errors: { _form: error?.message ?? 'Could not create the event.' } };
  }

  revalidatePath('/events');
  redirect(`/events/${data.id}`);
}

export async function updateEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get('eventId') ?? '');
  const parsed = eventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // The same check create performs. Without it the DB constraint fires and the
  // user gets a raw Postgres message instead of a field error.
  if (parsed.data.end_time && parsed.data.end_time < parsed.data.start_time) {
    return { errors: { end_time: 'The end time cannot be before the start time.' } };
  }

  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('events')
    .update(parsed.data)
    .eq('id', eventId)
    .select('id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You cannot edit this event.' } };

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
  return { message: 'Event updated.' };
}

export async function deleteEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get('eventId') ?? '');
  const { supabase } = await requireUser();

  const { data, error } = await supabase.from('events').delete().eq('id', eventId).select('id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You cannot delete this event.' } };

  revalidatePath('/events');
  redirect('/events');
}

export async function setRsvpAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const eventId = String(formData.get('eventId') ?? '');
  const status = String(formData.get('status') ?? '');
  const current = String(formData.get('current') ?? '');

  if (!['going', 'interested', 'not_going'].includes(status)) {
    return { errors: { _form: 'Invalid response.' } };
  }

  const { supabase, user } = await requireUser();

  // A write filtered out by RLS is not an error, so the affected rows have to
  // be inspected — otherwise a refused change looks like a successful one.
  const { error } =
    current === status
      ? // Tapping the active choice clears it.
        await supabase
          .from('event_rsvps')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .select('event_id')
      : await supabase
          .from('event_rsvps')
          .upsert(
            {
              event_id: eventId,
              user_id: user.id,
              status: status as 'going' | 'interested' | 'not_going',
            },
            { onConflict: 'event_id,user_id' },
          )
          .select('event_id');

  if (error) return { errors: { _form: 'Could not save your response.' } };

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
  revalidatePath('/dashboard');
  return { message: 'Saved.' };
}

export async function createAnnouncementAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const parsed = announcementSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    pinned: formData.get('pinned') === 'on',
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from('announcements')
    .insert({ ...parsed.data, created_by: user.id });

  if (error) {
    if (error.code === '42501') {
      return { errors: { _form: 'Only admins and club admins can publish announcements.' } };
    }
    return { errors: { _form: error.message } };
  }

  revalidatePath('/announcements');
  return { message: 'Announcement published.' };
}

export async function updateAnnouncementAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const id = String(formData.get('announcementId') ?? '');
  const parsed = announcementSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    pinned: formData.get('pinned') === 'on',
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('announcements')
    .update(parsed.data)
    .eq('id', id)
    .select('id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You cannot edit that announcement.' } };

  revalidatePath('/announcements');
  return { message: 'Announcement updated.' };
}

export async function togglePinAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const id = String(formData.get('announcementId') ?? '');
  const pinned = String(formData.get('pinned') ?? '') === 'true';

  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('announcements')
    .update({ pinned: !pinned })
    .eq('id', id)
    .select('id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You cannot change that announcement.' } };

  revalidatePath('/announcements');
  return { message: pinned ? 'Unpinned.' : 'Pinned.' };
}

export async function deleteAnnouncementAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const id = String(formData.get('announcementId') ?? '');

  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You cannot delete that announcement.' } };

  revalidatePath('/announcements');
  return { message: 'Deleted.' };
}

/**
 * Generates this user's due event reminders.
 *
 * Called from a client effect rather than during render: the notifications
 * page used to await this inside its Server Component, which ran an INSERT as
 * a side effect of rendering.
 */
export async function refreshEventRemindersAction(): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.rpc('generate_event_reminders', { lead_time: '24 hours' });
  revalidatePath('/notifications');
}

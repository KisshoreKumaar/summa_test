'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fieldErrors } from '@/lib/validation';

export interface MentorshipActionState {
  errors?: Record<string, string>;
  message?: string;
}

const mentorProfileSchema = z.object({
  expertise: z.array(z.string().trim().min(1).max(40)).min(1, 'Add at least one area of expertise').max(12),
  bio: z
    .string()
    .trim()
    .max(800, 'Keep it under 800 characters')
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  is_active: z.boolean(),
});

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

function revalidateMentorship(mentorId?: string) {
  revalidatePath('/mentorship');
  revalidatePath('/mentorship/requests');
  revalidatePath('/mentorship/me');
  if (mentorId) revalidatePath(`/mentorship/${mentorId}`);
}

export async function saveMentorProfileAction(
  _prev: MentorshipActionState,
  formData: FormData,
): Promise<MentorshipActionState> {
  const parsed = mentorProfileSchema.safeParse({
    expertise: formData.getAll('expertise').map(String).filter(Boolean),
    bio: formData.get('bio') ?? '',
    is_active: formData.get('is_active') !== 'false',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from('mentors')
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: 'user_id' });

  if (error) return { errors: { _form: error.message } };

  revalidateMentorship(user.id);
  return { message: 'Saved.' };
}

export async function leaveMentorDirectoryAction(
  _prev: MentorshipActionState,
): Promise<MentorshipActionState> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from('mentors').delete().eq('user_id', user.id);
  if (error) return { errors: { _form: error.message } };

  revalidateMentorship(user.id);
  return { message: 'You have left the mentor directory.' };
}

export async function setSeekingMentorshipAction(formData: FormData): Promise<void> {
  const seeking = formData.get('seeking') === 'true';
  const { supabase, user } = await requireUser();

  await supabase.from('profiles').update({ seeking_mentorship: seeking }).eq('id', user.id);

  revalidatePath('/mentorship');
  revalidatePath(`/profile/${user.id}`);
}

export async function requestMentorshipAction(
  _prev: MentorshipActionState,
  formData: FormData,
): Promise<MentorshipActionState> {
  const mentorId = String(formData.get('mentorId') ?? '');
  const message = String(formData.get('message') ?? '').trim();

  if (!mentorId) return { errors: { _form: 'Missing mentor.' } };
  if (!message) return { errors: { message: 'Say a little about what you need help with.' } };
  if (message.length > 1000) return { errors: { message: 'Keep it under 1000 characters.' } };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from('mentorship_requests')
    .insert({ mentor_id: mentorId, mentee_id: user.id, message });

  if (error) {
    // The partial unique index allows only one live thread per pair.
    if (error.code === '23505') {
      return { errors: { _form: 'You already have an open request with this mentor.' } };
    }
    if (error.code === '42501') {
      // Either the mentor has paused, or a recent decline is still cooling off.
      return {
        errors: {
          _form:
            'You cannot request this mentor right now. They may have paused new requests, or declined a recent request from you.',
        },
      };
    }
    return { errors: { _form: error.message } };
  }

  revalidateMentorship(mentorId);
  return { message: 'Request sent.' };
}

export async function respondToMentorshipAction(
  _prev: MentorshipActionState,
  formData: FormData,
): Promise<MentorshipActionState> {
  const requestId = String(formData.get('requestId') ?? '');
  const decision = String(formData.get('decision') ?? '');

  if (!['accepted', 'declined', 'completed'].includes(decision)) {
    return { errors: { _form: 'Invalid response.' } };
  }

  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('mentorship_requests')
    .update({ status: decision as 'accepted' | 'declined' | 'completed' })
    .eq('id', requestId)
    .select('id, mentor_id');

  if (error) {
    // The transition guard rejects illegal moves, e.g. completing a request
    // the mentor has not accepted yet.
    return { errors: { _form: 'That is not a valid change for this request.' } };
  }
  if (!data?.length) return { errors: { _form: 'That request is no longer open.' } };

  revalidateMentorship(data[0]?.mentor_id);
  return {
    message:
      decision === 'accepted'
        ? 'Accepted.'
        : decision === 'declined'
          ? 'Declined.'
          : 'Marked as completed.',
  };
}

export async function withdrawMentorshipAction(
  _prev: MentorshipActionState,
  formData: FormData,
): Promise<MentorshipActionState> {
  const requestId = String(formData.get('requestId') ?? '');
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('mentorship_requests')
    .delete()
    .eq('id', requestId)
    .select('id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'Only a pending request can be withdrawn.' } };

  revalidateMentorship();
  return { message: 'Request withdrawn.' };
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export async function addAvailabilityAction(
  _prev: MentorshipActionState,
  formData: FormData,
): Promise<MentorshipActionState> {
  const start = String(formData.get('slot_start') ?? '');
  const end = String(formData.get('slot_end') ?? '');

  if (!start || !end) return { errors: { _form: 'Pick a start and an end time.' } };
  if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
    return { errors: { _form: 'Enter valid times.' } };
  }
  if (end <= start) return { errors: { slot_end: 'The slot must end after it starts.' } };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from('mentor_availability')
    .insert({ mentor_id: user.id, slot_start: start, slot_end: end });

  if (error) return { errors: { _form: error.message } };

  revalidateMentorship(user.id);
  return { message: 'Slot added.' };
}

export async function removeAvailabilityAction(
  _prev: MentorshipActionState,
  formData: FormData,
): Promise<MentorshipActionState> {
  const slotId = String(formData.get('slotId') ?? '');
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from('mentor_availability')
    .delete()
    .eq('id', slotId)
    .select('id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'That slot could not be removed.' } };

  revalidateMentorship(user.id);
  return { message: 'Slot removed.' };
}

export async function bookSlotAction(
  _prev: MentorshipActionState,
  formData: FormData,
): Promise<MentorshipActionState> {
  const slotId = String(formData.get('slotId') ?? '');
  const mentorId = String(formData.get('mentorId') ?? '');

  const { supabase } = await requireUser();

  const { error } = await supabase.rpc('book_mentor_slot', { slot: slotId });

  if (error) {
    // The RPC raises readable messages for "already taken" and "you already
    // hold a session with this mentor"; pass them straight through.
    return { errors: { _form: error.message } };
  }

  revalidateMentorship(mentorId);
  return { message: 'Slot booked.' };
}

export async function releaseSlotAction(
  _prev: MentorshipActionState,
  formData: FormData,
): Promise<MentorshipActionState> {
  const slotId = String(formData.get('slotId') ?? '');
  const mentorId = String(formData.get('mentorId') ?? '');

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('release_mentor_slot', { slot: slotId });

  if (error) return { errors: { _form: error.message } };

  revalidateMentorship(mentorId);
  return { message: 'Booking released.' };
}

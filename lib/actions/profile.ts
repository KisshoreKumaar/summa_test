'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/queries/session';
import { fieldErrors, profileSchema } from '@/lib/validation';
import type { ProfileUpdate } from '@/lib/types/database';

export interface ProfileFormState {
  errors?: Record<string, string>;
  message?: string;
}

/** FormData carries tags as repeated entries; everything else is a string. */
function readProfileForm(formData: FormData) {
  return {
    full_name: formData.get('full_name'),
    year: formData.get('year'),
    branch: formData.get('branch'),
    bio: formData.get('bio'),
    skills: formData.getAll('skills').map(String).filter(Boolean),
    interests: formData.getAll('interests').map(String).filter(Boolean),
    github_url: formData.get('github_url') ?? '',
    linkedin_url: formData.get('linkedin_url') ?? '',
    portfolio_url: formData.get('portfolio_url') ?? '',
    visibility: formData.get('visibility') ?? 'department',
    avatar_url: (formData.get('avatar_url') as string) || null,
  };
}

async function saveProfile(
  formData: FormData,
  { markOnboarded }: { markOnboarded: boolean },
): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse(readProfileForm(formData));

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = createClient();
  const user = await getSessionUser();

  if (!user) redirect('/login');

  const update: ProfileUpdate = { ...parsed.data };
  if (markOnboarded) {
    update.onboarded_at = new Date().toISOString();
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);

  if (error) {
    return { errors: { _form: error.message } };
  }

  revalidatePath('/', 'layout');
  redirect(markOnboarded ? '/dashboard' : `/profile/${user.id}`);
}

export async function completeOnboardingAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return saveProfile(formData, { markOnboarded: true });
}

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return saveProfile(formData, { markOnboarded: false });
}

export async function updateVisibilityAction(formData: FormData) {
  const visibility = String(formData.get('visibility'));
  if (!['public', 'department', 'connections'].includes(visibility)) return;

  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) redirect('/login');

  await supabase
    .from('profiles')
    .update({ visibility: visibility as 'public' | 'department' | 'connections' })
    .eq('id', user.id);

  revalidatePath(`/profile/${user.id}`);
}

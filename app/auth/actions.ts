'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { fieldErrors, signInSchema, signUpSchema } from '@/lib/validation';
import { safeRedirectPath } from '@/lib/utils';

export interface AuthState {
  errors?: Record<string, string>;
  message?: string;
}

function originFromRequest() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;

  const host = headers().get('x-forwarded-host') ?? headers().get('host');
  const proto = headers().get('x-forwarded-proto') ?? 'http';
  return host ? `${proto}://${host}` : env.siteUrl();
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema(env.collegeEmailDomain()).safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${originFromRequest()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    // The database trigger rejects out-of-domain addresses; surface that
    // clearly instead of the raw Postgres message.
    const domain = env.collegeEmailDomain();
    const message = /restricted to/i.test(error.message)
      ? `Signups are restricted to @${domain} email addresses.`
      : error.message;
    return { errors: { _form: message } };
  }

  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { errors: { _form: 'Incorrect email or password.' } };
  }

  const redirectTo = safeRedirectPath(formData.get('redirectTo') as string | null);
  revalidatePath('/', 'layout');
  redirect(redirectTo);
}

export async function resendVerificationAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { errors: { _form: 'Email address is missing.' } };

  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${originFromRequest()}/auth/callback?next=/onboarding` },
  });

  if (error) return { errors: { _form: error.message } };
  return { message: 'Verification email sent. Check your inbox.' };
}

export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { errors: { email: 'Enter your email address.' } };

  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${originFromRequest()}/auth/callback?next=/reset-password`,
  });

  // Always report success so the form cannot be used to enumerate accounts.
  return { message: 'If that address has an account, a reset link is on its way.' };
}

export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  const { passwordSchema } = await import('@/lib/validation');
  const parsed = passwordSchema.safeParse(password);

  if (!parsed.success) {
    return { errors: { password: parsed.error.issues[0]!.message } };
  }
  if (password !== confirm) {
    return { errors: { confirmPassword: 'Passwords do not match.' } };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { errors: { _form: error.message } };

  redirect('/dashboard');
}

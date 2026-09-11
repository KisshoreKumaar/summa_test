import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeRedirectPath } from '@/lib/utils';

/**
 * Handles OAuth returns and emailed magic/confirmation links, then routes the
 * user to onboarding or their intended destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeRedirectPath(searchParams.get('next'));
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Invalid sign-in link.')}`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? 'Sign-in failed.')}`,
    );
  }

  // A Google account outside the allowed domain gets no profile row (the signup
  // trigger raises), so reject it here and clean the session up.
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    try {
      // Remove the orphaned auth user so the address can be retried later.
      await createAdminClient().auth.admin.deleteUser(data.user.id);
    } catch {
      // Service-role key not configured locally — the sign-out above is enough.
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        'That account is not eligible. Use your college email address.',
      )}`,
    );
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('This account has been deactivated.')}`,
    );
  }

  // A password-recovery link must reach the reset form even if the user has
  // not finished onboarding yet.
  const destination =
    next === '/reset-password' || profile.onboarded_at ? next : '/onboarding';

  return NextResponse.redirect(`${origin}${destination}`);
}

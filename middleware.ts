import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/** Routes reachable without a session. */
const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

/**
 * Public routes that a signed-in user should be bounced away from.
 * `/reset-password` is deliberately excluded: the recovery link signs the user
 * in first, so they arrive there with a session and must be allowed to stay.
 */
const SIGNED_OUT_ONLY_ROUTES = ['/login', '/signup', '/forgot-password'];

/** Routes an authenticated-but-not-yet-onboarded user may still reach. */
const ONBOARDING_EXEMPT = ['/onboarding', '/verify-email', '/auth'];

function matches(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function middleware(request: NextRequest) {
  const { supabase, response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // Auth callback and sign-out handlers manage their own redirects.
  if (pathname.startsWith('/auth/')) return response;

  const isPublic = matches(pathname, PUBLIC_ROUTES);

  if (!user) {
    if (isPublic || pathname === '/') return response;

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in but the email is still unconfirmed.
  if (!user.email_confirmed_at && pathname !== '/verify-email') {
    return NextResponse.redirect(new URL('/verify-email', request.url));
  }

  // Nothing left to verify, so the verification screen is a dead end.
  if (user.email_confirmed_at && pathname === '/verify-email') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Signed-in users have no business on the login/signup screens.
  if (matches(pathname, SIGNED_OUT_ONLY_ROUTES)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!matches(pathname, ONBOARDING_EXEMPT)) {
    const { data: profile, error } = await supabase
      .from('profiles')
      // `role` is only needed for /admin, but it rides along on a query that
      // already runs rather than adding a second round trip.
      .select('onboarded_at, is_active, role')
      .eq('id', user.id)
      .maybeSingle();

    /*
     * A session with no profile row is unrecoverable: every authenticated
     * layout redirects on a missing profile, and those targets are themselves
     * guarded, so letting the request through produces a redirect loop. Clear
     * the session instead.
     *
     * A query *error* is different — that is usually a transient Supabase
     * blip, and signing people out over it would be worse than letting the
     * request proceed.
     */
    if (!error && !profile) {
      return NextResponse.redirect(new URL('/auth/signout', request.url));
    }

    if (profile && !profile.is_active) {
      return NextResponse.redirect(new URL('/auth/signout', request.url));
    }

    if (profile && !profile.onboarded_at) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    /*
     * Guard the admin panel. This is convenience, not the boundary — every
     * admin RPC re-checks the caller's role in SQL, so a direct API call gets
     * nowhere even if this check were bypassed.
     */
    if (pathname.startsWith('/admin') && profile?.role === 'student') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets — the session must be
     * refreshed on real navigations, not on every image request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

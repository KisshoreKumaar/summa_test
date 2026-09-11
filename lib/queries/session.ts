import 'server-only';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * The signed-in user, resolved once per request.
 *
 * `supabase.auth.getUser()` is a network call to the Auth server, not a local
 * token decode. Every query helper calling it independently meant a single
 * dashboard render spent most of its time re-validating the same JWT, so this
 * is wrapped in React's `cache` and shared by everything server-side.
 *
 * Middleware deliberately does not use this: it runs before the render pass
 * with its own client, and its `getUser()` call is what refreshes the session.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

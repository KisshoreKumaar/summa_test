import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from '@/lib/types/database';

/**
 * Server client for Server Components, Route Handlers, and Server Actions.
 * Writing cookies throws in a Server Component render, which is expected —
 * middleware refreshes the session, so the failure is safe to swallow.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component; middleware handles the refresh.
        }
      },
    },
  });
}

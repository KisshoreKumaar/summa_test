'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from '@/lib/types/database';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Singleton browser client — one instance keeps a single auth listener alive. */
export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(env.supabaseUrl(), env.supabaseAnonKey());
  }
  return browserClient;
}

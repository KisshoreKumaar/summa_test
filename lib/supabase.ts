/**
 * Central Supabase client (browser).
 *
 *   import { createClient } from '@/lib/supabase';
 *
 * Server-side variants live in sibling modules and must be imported directly,
 * so that `next/headers` and the service-role key never reach the client
 * bundle:
 *
 *   import { createClient } from '@/lib/supabase/server';  // RLS as the user
 *   import { createAdminClient } from '@/lib/supabase/admin';  // service role
 */
export { createClient } from '@/lib/supabase/client';
export type { Database, Profile, ProfileUpdate, ProfileVisibility, UserRole } from '@/lib/types/database';

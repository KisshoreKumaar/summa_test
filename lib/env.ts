/**
 * Environment access with fail-fast messages. Next inlines `process.env.X`
 * at build time only for literal member access, so the keys are spelled out.
 */
function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: () => required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () =>
    required(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  siteUrl: () =>
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000',
  collegeEmailDomain: () =>
    (process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN ?? '').trim().replace(/^@/, '').toLowerCase(),
};

import { z } from 'zod';
import { MAX_BIO_LENGTH, MAX_INTERESTS, MAX_SKILLS } from '@/lib/constants';

/** Optional URL field: empty string / undefined both normalise to null. */
const optionalUrl = (host?: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .refine(
      (v) => {
        if (!v) return true;
        try {
          const url = new URL(v.startsWith('http') ? v : `https://${v}`);
          return host ? url.hostname.endsWith(host) : true;
        } catch {
          return false;
        }
      },
      { message: host ? `Must be a ${host} link` : 'Must be a valid URL' },
    )
    .transform((v) => (v && !v.startsWith('http') ? `https://${v}` : v));

/**
 * Avatars must live in this project's public `avatars` bucket. The seed script
 * runs with the service role and bypasses this, so seeded placeholder avatars
 * from other hosts are still fine.
 */
export function isAllowedAvatarUrl(value: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  try {
    const url = new URL(value);
    const expected = new URL(base);
    return (
      url.origin === expected.origin &&
      url.pathname.startsWith('/storage/v1/object/public/avatars/')
    );
  } catch {
    return false;
  }
}

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/[0-9]/, 'Include at least one number');

/** Signup email validator — the domain check is applied on top of this. */
export function emailSchema(collegeDomain: string) {
  const base = z.string().trim().toLowerCase().email('Enter a valid email address');
  if (!collegeDomain) return base;
  return base.refine((v) => v.endsWith(`@${collegeDomain}`), {
    message: `Use your @${collegeDomain} college email address`,
  });
}

export function signUpSchema(collegeDomain: string) {
  return z.object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(80),
    email: emailSchema(collegeDomain),
    password: passwordSchema,
  });
}

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(80),
  year: z
    .union([z.coerce.number().int().min(1).max(5), z.literal('').transform(() => null), z.null()])
    .nullable(),
  branch: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  bio: z
    .string()
    .trim()
    .max(MAX_BIO_LENGTH, `Bio must be ${MAX_BIO_LENGTH} characters or fewer`)
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  skills: z.array(z.string().trim().min(1).max(40)).max(MAX_SKILLS),
  interests: z.array(z.string().trim().min(1).max(40)).max(MAX_INTERESTS),
  github_url: optionalUrl('github.com'),
  linkedin_url: optionalUrl('linkedin.com'),
  portfolio_url: optionalUrl(),
  visibility: z.enum(['public', 'department', 'connections']),
  /*
   * Only accept URLs pointing at our own avatars bucket. Without this a
   * crafted request could park an arbitrary third-party URL on the profile,
   * which then loads for everyone who views it.
   */
  avatar_url: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .refine((v) => !v || isAllowedAvatarUrl(v), { message: 'Invalid avatar URL' }),
});

export type ProfileFormValues = z.input<typeof profileSchema>;
export type ProfileFormOutput = z.output<typeof profileSchema>;

/** Turns a ZodError into a `{ field: message }` map for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

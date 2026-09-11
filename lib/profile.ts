import type { Profile } from '@/lib/types/database';

/** Fields that count toward the completeness indicator, in display order. */
const COMPLETENESS_FIELDS: { key: string; label: string; filled: (p: Profile) => boolean }[] = [
  { key: 'full_name', label: 'Full name', filled: (p) => !!p.full_name?.trim() },
  { key: 'year', label: 'Year', filled: (p) => p.year != null },
  { key: 'branch', label: 'Branch', filled: (p) => !!p.branch?.trim() },
  { key: 'bio', label: 'Bio', filled: (p) => !!p.bio?.trim() },
  { key: 'avatar_url', label: 'Profile photo', filled: (p) => !!p.avatar_url },
  { key: 'skills', label: 'Skills', filled: (p) => p.skills.length > 0 },
  { key: 'interests', label: 'Interests', filled: (p) => p.interests.length > 0 },
  {
    key: 'links',
    label: 'A social or portfolio link',
    filled: (p) => !!(p.github_url || p.linkedin_url || p.portfolio_url),
  },
];

export interface Completeness {
  percent: number;
  filled: number;
  total: number;
  missing: { key: string; label: string }[];
}

export function profileCompleteness(profile: Profile): Completeness {
  const missing = COMPLETENESS_FIELDS.filter((f) => !f.filled(profile)).map(({ key, label }) => ({
    key,
    label,
  }));
  const filled = COMPLETENESS_FIELDS.length - missing.length;

  return {
    percent: Math.round((filled / COMPLETENESS_FIELDS.length) * 100),
    filled,
    total: COMPLETENESS_FIELDS.length,
    missing,
  };
}

/** Onboarding is considered done once the required basics are present. */
export function hasCompletedOnboarding(profile: Pick<Profile, 'onboarded_at'>) {
  return profile.onboarded_at != null;
}

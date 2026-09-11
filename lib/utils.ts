import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string | null | undefined, fallback = '?') {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** "3rd year" etc. — used on profile cards and headers. */
export function yearLabel(year: number | null | undefined) {
  if (!year) return null;
  const suffix = year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th';
  return `${year}${suffix} year`;
}

/**
 * Sanitises a user-supplied redirect target.
 *
 * Only same-origin absolute paths are allowed. Protocol-relative values like
 * `//evil.com` and absolute URLs like `https://evil.com` are rejected: the
 * former would be followed off-site by the browser, and the latter throws when
 * concatenated onto an origin.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!raw) return fallback;
  // Must start with a single "/" that is not followed by "/" or "\\".
  if (!/^\/[^/\\]/.test(raw)) return fallback;
  return raw;
}

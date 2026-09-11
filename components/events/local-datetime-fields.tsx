'use client';

import { Input } from '@/components/ui/input';

/**
 * `<input type="datetime-local">` submits a bare wall-clock string with no
 * zone — "2026-08-25T14:30". Sent as-is it lands in a timestamptz and is read
 * in the *database's* zone, so an admin in UTC+5:30 scheduled events five and a
 * half hours late.
 *
 * `toIsoInstant` runs in the browser, where `new Date(wallClock)` resolves
 * against the admin's own zone, producing the instant they actually meant.
 */
export function toIsoInstant(value: FormDataEntryValue | null): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

/** Rewrites the named datetime fields in place before the action runs. */
export function localiseFields(formData: FormData, ...names: string[]) {
  for (const name of names) {
    formData.set(name, toIsoInstant(formData.get(name)));
  }
}

/** The event form's pair. */
export function localiseEventTimes(formData: FormData) {
  localiseFields(formData, 'start_time', 'end_time');
}

export function DateTimeField({
  name,
  label,
  error,
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <Input
      name={name}
      type="datetime-local"
      label={label}
      error={error}
      required={required}
      defaultValue={defaultValue}
      hint="Uses your device's time zone."
    />
  );
}

'use client';

import { useEffect, useState } from 'react';

function format(startIso: string, endIso: string | null, timeZone?: string) {
  const start = new Date(startIso);

  const date = start.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  });
  const time = start.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  });

  if (!endIso) return `${date}, ${time}`;

  const end = new Date(endIso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  });

  return `${date}, ${time} – ${end}`;
}

/**
 * Event times are instants, and they have to be shown in the *reader's* zone.
 *
 * A Server Component would format in the container's zone (UTC in production),
 * which silently showed everyone the wrong wall-clock time. So the first paint
 * is explicitly labelled UTC — identical on server and client, so there is no
 * hydration mismatch — and the local rendering replaces it after mount.
 */
export function EventTime({ start, end }: { start: string; end?: string | null }) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    setLocal(format(start, end ?? null));
  }, [start, end]);

  return <time dateTime={start}>{local ?? format(start, end ?? null, 'UTC')}</time>;
}

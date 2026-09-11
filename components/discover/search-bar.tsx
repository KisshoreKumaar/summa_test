'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * Debounced search box. Writes to the `q` query param so results stay
 * shareable and survive a refresh.
 */
export function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  const urlQuery = searchParams.get('q') ?? '';

  /*
   * The debounce fires up to 300ms after the last keystroke, by which time the
   * filter panel may have rewritten the URL. Reading the params through a ref
   * means the timer merges into the *current* URL rather than the one captured
   * when the user last typed — otherwise choosing a filter mid-type silently
   * discarded it.
   */
  const paramsRef = useRef(searchParams);

  // Updated in an effect rather than during render: a render that concurrent
  // React throws away must not leave the ref pointing at params that were
  // never committed.
  useEffect(() => {
    paramsRef.current = searchParams;
  }, [searchParams]);

  /*
   * The last value this component pushed itself, so a URL change made
   * elsewhere (Clear filters, the back button) can be told apart from our own
   * and mirrored back into the input.
   */
  const committedRef = useRef(initialQuery);

  useEffect(() => {
    if (urlQuery === committedRef.current) return;
    committedRef.current = urlQuery;
    setValue(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === urlQuery) return; // already reflected in the URL

    const timer = setTimeout(() => {
      const params = new URLSearchParams(paramsRef.current.toString());

      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      params.delete('page');

      committedRef.current = trimmed;

      const next = params.toString();
      router.replace(next ? `/discover?${next}` : '/discover', { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, urlQuery, router]);

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search by name, skill, or interest…"
      aria-label="Search students"
      leftIcon={<Search className="h-4 w-4" />}
      rightSlot={
        value ? (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label="Clear search"
            className="rounded p-1.5 text-slate-400 transition-colors hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : undefined
      }
    />
  );
}

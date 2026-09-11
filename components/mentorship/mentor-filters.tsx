'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BRANCHES, SKILL_SUGGESTIONS, YEARS } from '@/lib/constants';
import { cn, yearLabel } from '@/lib/utils';

export function MentorFilters({
  initialQuery,
  expertise,
  branches,
  years,
}: {
  initialQuery: string;
  expertise: string[];
  branches: string[];
  years: number[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  // Read params through a ref so a pending debounce cannot overwrite a filter
  // the user clicks mid-flight.
  const paramsRef = useRef(searchParams);
  paramsRef.current = searchParams;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(paramsRef.current.toString());
      const trimmed = value.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      params.delete('page');
      const qs = params.toString();
      router.replace(qs ? `/mentorship?${qs}` : '/mentorship', { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, router]);

  function toggle(key: string, entry: string) {
    const params = new URLSearchParams(paramsRef.current.toString());
    const current = params.getAll(key);
    params.delete(key);
    const next = current.includes(entry)
      ? current.filter((v) => v !== entry)
      : [...current, entry];
    next.forEach((v) => params.append(key, v));
    params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `/mentorship?${qs}` : '/mentorship', { scroll: false });
  }

  return (
    <div className="space-y-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search mentors by name or expertise…"
        aria-label="Search mentors"
        leftIcon={<Search className="h-4 w-4" />}
      />

      <div className="space-y-2">
        <Group label="Expertise">
          {SKILL_SUGGESTIONS.slice(0, 10).map((tag) => (
            <Chip
              key={tag}
              active={expertise.includes(tag)}
              onClick={() => toggle('expertise', tag)}
            >
              {tag}
            </Chip>
          ))}
        </Group>

        <Group label="Branch">
          {BRANCHES.map((b) => (
            <Chip key={b} active={branches.includes(b)} onClick={() => toggle('branch', b)}>
              {b}
            </Chip>
          ))}
        </Group>

        <Group label="Year">
          {YEARS.map((y) => (
            <Chip key={y} active={years.includes(y)} onClick={() => toggle('year', String(y))}>
              {yearLabel(y)}
            </Chip>
          ))}
        </Group>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/50',
      )}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </div>
  );
}

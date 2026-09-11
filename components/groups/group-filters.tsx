'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { GroupCategory } from '@/lib/types/database';
import { CATEGORY_LABEL } from '@/components/groups/group-card';

const CATEGORIES: GroupCategory[] = ['club', 'batch', 'project', 'interest'];

export function GroupFilters({
  initialQuery,
  category,
  mine,
}: {
  initialQuery: string;
  category?: GroupCategory;
  mine: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  /*
   * The current params are read through a ref rather than closed over, so a
   * pending debounce cannot overwrite a filter the user clicks mid-flight.
   */
  const paramsRef = useRef(searchParams);
  paramsRef.current = searchParams;

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(paramsRef.current.toString());
      const trimmed = value.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');

      const qs = params.toString();
      router.replace(qs ? `/groups?${qs}` : '/groups', { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, router]);

  function withParam(key: string, next: string | null) {
    const params = new URLSearchParams(paramsRef.current.toString());
    if (next === null) params.delete(key);
    else params.set(key, next);
    const qs = params.toString();
    return qs ? `/groups?${qs}` : '/groups';
  }

  return (
    <div className="space-y-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search groups…"
        aria-label="Search groups"
        leftIcon={<Search className="h-4 w-4" />}
      />

      <div className="flex flex-wrap gap-1.5">
        <Chip href={withParam('mine', mine ? null : '1')} active={mine}>
          My groups
        </Chip>
        <span className="mx-1 w-px bg-slate-200" />
        <Chip href={withParam('category', null)} active={!category}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} href={withParam('category', c)} active={category === c}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => router.replace(href, { scroll: false })}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition-colors',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/50',
      )}
    >
      {children}
    </button>
  );
}

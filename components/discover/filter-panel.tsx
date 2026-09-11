'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { INTEREST_SUGGESTIONS, SKILL_SUGGESTIONS, YEARS } from '@/lib/constants';
import { cn, yearLabel } from '@/lib/utils';

export interface FilterPanelProps {
  branches: string[];
  selected: {
    branches: string[];
    years: number[];
    skills: string[];
    interests: string[];
  };
}

export function FilterPanel({ branches, selected }: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeCount =
    selected.branches.length +
    selected.years.length +
    selected.skills.length +
    selected.interests.length;

  const toggle = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = params.getAll(key);

      params.delete(key);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      next.forEach((v) => params.append(key, v));
      params.delete('page');

      const qs = params.toString();
      router.replace(qs ? `/discover?${qs}` : '/discover', { scroll: false });
    },
    [router, searchParams],
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    ['branch', 'year', 'skill', 'interest', 'page'].forEach((k) => params.delete(k));
    const qs = params.toString();
    router.replace(qs ? `/discover?${qs}` : '/discover', { scroll: false });
  }, [router, searchParams]);

  return (
    <div>
      <div className="flex items-center justify-between lg:hidden">
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-xs text-white">
              {activeCount}
            </span>
          )}
        </Button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Clear all
          </button>
        )}
      </div>

      <Card className={cn('mt-3 lg:mt-0 lg:block', open ? 'block' : 'hidden')}>
        <CardContent className="space-y-5 py-5">
          <div className="hidden items-center justify-between lg:flex">
            <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <X className="h-3 w-3" aria-hidden />
                Clear
              </button>
            )}
          </div>

          <FilterGroup
            label="Branch"
            options={branches}
            selected={selected.branches}
            onToggle={(v) => toggle('branch', v)}
          />

          <FilterGroup
            label="Year"
            options={YEARS.map(String)}
            renderLabel={(v) => yearLabel(Number(v)) ?? v}
            selected={selected.years.map(String)}
            onToggle={(v) => toggle('year', v)}
          />

          <FilterGroup
            label="Skills"
            options={SKILL_SUGGESTIONS.slice(0, 12)}
            selected={selected.skills}
            onToggle={(v) => toggle('skill', v)}
          />

          <FilterGroup
            label="Interests"
            options={INTEREST_SUGGESTIONS.slice(0, 12)}
            selected={selected.interests}
            onToggle={(v) => toggle('interest', v)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
  renderLabel,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  renderLabel?: (value: string) => string;
}) {
  if (options.length === 0) return null;

  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                active
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/50',
              )}
            >
              {renderLabel ? renderLabel(option) : option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

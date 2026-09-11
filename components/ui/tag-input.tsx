'use client';

import { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TagInputProps {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
  error?: string;
  hint?: string;
}

/**
 * Multi-select tag field: type + Enter/comma to add, Backspace to remove the
 * last one, or pick from the suggestion chips below the field.
 */
export function TagInput({
  label,
  value,
  onChange,
  suggestions = [],
  placeholder = 'Type and press Enter',
  max = 15,
  error,
  hint,
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const atMax = value.length >= max;

  const lowered = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const visibleSuggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter((s) => !lowered.has(s.toLowerCase()))
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [suggestions, lowered, draft]);

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,+$/, '');
    if (!tag || atMax || lowered.has(tag.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, tag.slice(0, 40)]);
    setDraft('');
  }

  function removeTag(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      removeTag(value[value.length - 1]!);
    }
  }

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <span className="text-xs tabular-nums text-slate-400">
            {value.length}/{max}
          </span>
        </div>
      )}

      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'flex min-h-[2.5rem] w-full flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 shadow-sm',
          'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/40',
          error ? 'border-red-400' : 'border-slate-300',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-brand-50 py-1 pl-2 pr-1 text-xs font-medium text-brand-700"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              aria-label={`Remove ${tag}`}
              className="rounded p-0.5 text-brand-500 transition-colors hover:bg-brand-100 hover:text-brand-800"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && addTag(draft)}
          disabled={atMax}
          placeholder={atMax ? `Limit of ${max} reached` : value.length === 0 ? placeholder : ''}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      {visibleSuggestions.length > 0 && !atMax && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {visibleSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

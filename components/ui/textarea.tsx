'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  maxLengthCounter?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, error, hint, maxLengthCounter, id, value, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const length = typeof value === 'string' ? value.length : 0;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        {maxLengthCounter && (
          <span
            className={cn(
              'text-xs tabular-nums',
              length > maxLengthCounter ? 'text-red-600' : 'text-slate-400',
            )}
          >
            {length}/{maxLengthCounter}
          </span>
        )}
      </div>
      <textarea
        ref={ref}
        id={textareaId}
        value={value}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm',
          'placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
          error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30' : 'border-slate-300',
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});

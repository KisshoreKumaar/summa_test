'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A number', test: (p: string) => /[0-9]/.test(p) },
];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  return (
    <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
      {RULES.map(({ label, test }) => {
        const passed = test(password);
        const Icon = passed ? Check : X;
        return (
          <li
            key={label}
            className={cn(
              'flex items-center gap-1.5 text-xs',
              passed ? 'text-emerald-600' : 'text-slate-500',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {label}
          </li>
        );
      })}
    </ul>
  );
}

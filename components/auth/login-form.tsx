'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { signInAction, type AuthState } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormError } from '@/components/auth/form-error';

const initialState: AuthState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth loading={pending}>
      Sign in
    </Button>
  );
}

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useFormState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <FormError message={state.errors?._form} />

      <Input
        name="email"
        type="email"
        label="College email"
        autoComplete="email"
        placeholder="you@college-domain.edu"
        leftIcon={<Mail className="h-4 w-4" />}
        error={state.errors?.email}
        required
      />

      <Input
        name="password"
        type={showPassword ? 'text' : 'password'}
        label="Password"
        autoComplete="current-password"
        placeholder="••••••••"
        leftIcon={<Lock className="h-4 w-4" />}
        error={state.errors?.password}
        required
        rightSlot={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="rounded p-1.5 text-slate-400 transition-colors hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-brand-600 hover:text-brand-700">
          Forgot password?
        </Link>
      </div>

      <SubmitButton />
    </form>
  );
}

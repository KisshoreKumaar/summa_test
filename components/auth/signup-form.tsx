'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { signUpAction, type AuthState } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormError } from '@/components/auth/form-error';
import { PasswordStrength } from '@/components/auth/password-strength';

const initialState: AuthState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth loading={pending}>
      Create account
    </Button>
  );
}

export function SignupForm({ collegeDomain }: { collegeDomain: string }) {
  const [state, formAction] = useFormState(signUpAction, initialState);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.errors?._form} />

      <Input
        name="fullName"
        label="Full name"
        autoComplete="name"
        placeholder="Aditi Sharma"
        leftIcon={<User className="h-4 w-4" />}
        error={state.errors?.fullName}
        required
      />

      <Input
        name="email"
        type="email"
        label="College email"
        autoComplete="email"
        placeholder={collegeDomain ? `you@${collegeDomain}` : 'you@example.edu'}
        leftIcon={<Mail className="h-4 w-4" />}
        error={state.errors?.email}
        hint={collegeDomain ? `Must end in @${collegeDomain}` : undefined}
        required
      />

      <div>
        <Input
          name="password"
          type={showPassword ? 'text' : 'password'}
          label="Password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          leftIcon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        <PasswordStrength password={password} />
      </div>

      <SubmitButton />

      <p className="text-center text-xs text-slate-500">
        We will email you a verification link before your account is fully active.
      </p>
    </form>
  );
}

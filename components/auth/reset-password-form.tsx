'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Lock } from 'lucide-react';
import { updatePasswordAction, type AuthState } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormError } from '@/components/auth/form-error';
import { PasswordStrength } from '@/components/auth/password-strength';

const initialState: AuthState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth loading={pending}>
      Update password
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(updatePasswordAction, initialState);
  const [password, setPassword] = useState('');

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.errors?._form} />

      <div>
        <Input
          name="password"
          type="password"
          label="New password"
          autoComplete="new-password"
          leftIcon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={state.errors?.password}
          required
        />
        <PasswordStrength password={password} />
      </div>

      <Input
        name="confirmPassword"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        leftIcon={<Lock className="h-4 w-4" />}
        error={state.errors?.confirmPassword}
        required
      />

      <SubmitButton />
    </form>
  );
}

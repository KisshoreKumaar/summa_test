'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Mail } from 'lucide-react';
import { requestPasswordResetAction, type AuthState } from '@/app/auth/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormError } from '@/components/auth/form-error';

const initialState: AuthState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth loading={pending}>
      Send reset link
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordResetAction, initialState);

  if (state.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.errors?._form} />
      <Input
        name="email"
        type="email"
        label="College email"
        autoComplete="email"
        leftIcon={<Mail className="h-4 w-4" />}
        error={state.errors?.email}
        required
      />
      <SubmitButton />
    </form>
  );
}

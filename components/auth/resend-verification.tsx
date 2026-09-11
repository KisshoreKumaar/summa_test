'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { resendVerificationAction, type AuthState } from '@/app/auth/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const initialState: AuthState = {};

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" loading={pending}>
      Resend verification email
    </Button>
  );
}

export function ResendVerification({ email, signedIn }: { email: string; signedIn: boolean }) {
  const [state, formAction] = useFormState(resendVerificationAction, initialState);

  return (
    <div className="space-y-4">
      {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <form action={formAction} className="flex flex-col items-center gap-3">
        <input type="hidden" name="email" value={email} />
        <ResendButton />
      </form>

      {/* A <form> cannot live inside a <p>, so this block stays a <div>. */}
      <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
        <span>Wrong address or already verified?</span>
        {signedIn ? (
          <form action="/auth/signout" method="post">
            <button type="submit" className="font-medium text-brand-600 hover:text-brand-700">
              Sign out
            </button>
          </form>
        ) : (
          <a href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </a>
        )}
      </div>
    </div>
  );
}

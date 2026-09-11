import Link from 'next/link';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { GoogleButton } from '@/components/auth/google-button';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { safeRedirectPath } from '@/lib/utils';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; error?: string };
}) {
  const redirectTo = safeRedirectPath(searchParams.redirectTo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to your Student Connect account.</p>
      </div>

      {searchParams.error && <Alert tone="error">{searchParams.error}</Alert>}

      <Card>
        <CardContent className="space-y-5 py-6">
          <GoogleButton next={redirectTo} label="Sign in with Google" />

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <LoginForm redirectTo={redirectTo} />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-slate-600">
        New here?{' '}
        <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
          Create an account
        </Link>
      </p>
    </div>
  );
}

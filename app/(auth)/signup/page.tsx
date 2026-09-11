import Link from 'next/link';
import type { Metadata } from 'next';
import { SignupForm } from '@/components/auth/signup-form';
import { GoogleButton } from '@/components/auth/google-button';
import { Card, CardContent } from '@/components/ui/card';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Create account' };

export default function SignupPage() {
  const domain = env.collegeEmailDomain();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">
          {domain
            ? `Open to students with an @${domain} email address.`
            : 'Join your department on Student Connect.'}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 py-6">
          <GoogleButton next="/onboarding" label="Sign up with Google" />

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <SignupForm collegeDomain={domain} />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}

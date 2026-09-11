import type { Metadata } from 'next';
import { MailCheck } from 'lucide-react';
import { getSessionUser } from '@/lib/queries/session';
import { ResendVerification } from '@/components/auth/resend-verification';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Verify your email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const user = await getSessionUser();

  const email = user?.email ?? searchParams.email ?? '';

  return (
    <Card>
      <CardContent className="space-y-5 py-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <MailCheck className="h-6 w-6 text-brand-600" aria-hidden />
        </span>

        <div>
          <h1 className="text-xl font-bold text-slate-900">Check your inbox</h1>
          <p className="mt-2 text-sm text-slate-600">
            We sent a verification link
            {email ? (
              <>
                {' '}
                to <span className="font-medium text-slate-900">{email}</span>
              </>
            ) : null}
            . Click it to activate your account.
          </p>
        </div>

        <ResendVerification email={email} signedIn={!!user} />
      </CardContent>
    </Card>
  );
}

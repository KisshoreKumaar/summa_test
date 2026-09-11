import Link from 'next/link';
import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter your college email and we will send you a reset link.
        </p>
      </div>

      <Card>
        <CardContent className="py-6">
          <ForgotPasswordForm />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-slate-600">
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

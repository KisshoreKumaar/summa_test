import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick something you have not used on this account before.
        </p>
      </div>

      <Card>
        <CardContent className="py-6">
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

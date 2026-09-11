import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { profileCompleteness } from '@/lib/profile';
import type { Profile } from '@/lib/types/database';

export function CompletenessCard({ profile }: { profile: Profile }) {
  const { percent, filled, total, missing } = profileCompleteness(profile);
  const complete = missing.length === 0;

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-slate-900">Profile strength</h2>
          <span className="text-lg font-bold tabular-nums text-brand-600">{percent}%</span>
        </div>

        <Progress value={percent} className="mt-3" label="Profile completeness" />

        <p className="mt-2 text-sm text-slate-500">
          {filled} of {total} sections filled in
        </p>

        {complete ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Your profile is complete.
          </p>
        ) : (
          <>
            <ul className="mt-4 space-y-2">
              {missing.map(({ key, label }) => (
                <li key={key} className="flex items-center gap-2 text-sm text-slate-600">
                  <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
            <Link
              href="/profile/edit"
              className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Complete your profile
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

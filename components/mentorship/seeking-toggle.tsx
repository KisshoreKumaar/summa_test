'use client';

import { HandHeart } from 'lucide-react';
import { setSeekingMentorshipAction } from '@/lib/actions/mentorship';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * The other half of "opt in as a mentor or as someone seeking mentorship".
 * Flagging yourself makes it clear to mentors that you are looking.
 */
export function SeekingToggle({ seeking }: { seeking: boolean }) {
  return (
    <Card className={cn(seeking && 'border-brand-200 bg-brand-50/40')}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              seeking ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500',
            )}
          >
            <HandHeart className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {seeking ? 'You are looking for a mentor' : 'Looking for a mentor?'}
            </p>
            <p className="text-sm text-slate-600">
              {seeking
                ? 'Mentors can see that you are open to guidance.'
                : 'Let mentors know you would welcome guidance.'}
            </p>
          </div>
        </div>

        <form action={setSeekingMentorshipAction}>
          <input type="hidden" name="seeking" value={String(!seeking)} />
          <button
            type="submit"
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              seeking
                ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                : 'bg-brand-600 text-white hover:bg-brand-700',
            )}
          >
            {seeking ? 'Stop looking' : 'I am looking'}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

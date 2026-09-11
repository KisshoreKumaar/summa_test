import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'success' | 'error';

const TONES: Record<Tone, { wrapper: string; Icon: typeof Info }> = {
  info: { wrapper: 'border-brand-200 bg-brand-50 text-brand-900', Icon: Info },
  success: { wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CheckCircle2 },
  error: { wrapper: 'border-red-200 bg-red-50 text-red-900', Icon: AlertCircle },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { wrapper, Icon } = TONES[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', wrapper, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}

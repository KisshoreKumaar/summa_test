import Image from 'next/image';
import { cn, initials } from '@/lib/utils';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
  '2xl': 'h-32 w-32 text-4xl',
} as const;

const PIXELS = { xs: 24, sm: 32, md: 40, lg: 64, xl: 96, '2xl': 128 } as const;

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-brand-100 font-semibold text-brand-700 ring-1 ring-slate-900/5',
        SIZES[size],
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={name ? `${name}'s profile photo` : 'Profile photo'}
          width={PIXELS[size]}
          height={PIXELS[size]}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}

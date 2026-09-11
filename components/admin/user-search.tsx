'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function AdminUserSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const trimmed = value.trim();
      router.replace(
        trimmed ? `/admin/users?q=${encodeURIComponent(trimmed)}` : '/admin/users',
        { scroll: false },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [value, router]);

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search by name or email…"
      aria-label="Search users"
      leftIcon={<Search className="h-4 w-4" />}
    />
  );
}

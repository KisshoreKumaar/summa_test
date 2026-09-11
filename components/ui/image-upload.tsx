'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';
import { ACCEPTED_AVATAR_TYPES, MAX_AVATAR_BYTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

export interface ImageUploadProps {
  /** Storage bucket to write into, e.g. 'event-covers'. */
  bucket: string;
  /** Files live under a folder named for the uploader, which the RLS requires. */
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  hint?: string;
  className?: string;
}

/**
 * Cover-image picker. Generalised from AvatarUpload so events and groups share
 * one implementation rather than each growing their own.
 */
export function ImageUpload({
  bucket,
  userId,
  value,
  onChange,
  label = 'Cover image',
  hint = 'JPG, PNG, or WebP. Max 2 MB.',
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError(`Image must be under ${Math.round(MAX_AVATAR_BYTES / 1024 / 1024)} MB.`);
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);

      await removePrevious(supabase, bucket, userId, value);
      onChange(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'group relative flex h-32 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors',
          value
            ? 'border-transparent'
            : 'border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40',
        )}
      >
        {value ? (
          <>
            <Image
              src={value}
              alt=""
              fill
              className="object-cover"
              unoptimized
              sizes="(max-width: 768px) 100vw, 640px"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/50 opacity-0 transition-opacity group-hover:opacity-100">
              <ImagePlus className="h-6 w-6 text-white" aria-hidden />
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 text-slate-500">
            <ImagePlus className="h-6 w-6" aria-hidden />
            <span className="text-sm">{uploading ? 'Uploading…' : 'Add a cover image'}</span>
          </span>
        )}
      </button>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{hint}</p>
        {value && !uploading && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove
          </Button>
        )}
      </div>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_AVATAR_TYPES.join(',')}
        onChange={handleFile}
        className="sr-only"
      />
    </div>
  );
}

/** Best-effort cleanup of the file this one replaces. */
async function removePrevious(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
  previousUrl: string | null,
) {
  if (!previousUrl) return;

  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = previousUrl.indexOf(marker);
  if (index === -1) return;

  const path = decodeURIComponent(previousUrl.slice(index + marker.length)).split('?')[0];
  if (!path || !path.startsWith(`${userId}/`)) return;

  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // An orphaned file is not worth interrupting the user for.
  }
}

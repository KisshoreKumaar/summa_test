'use client';

import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';
import { ACCEPTED_AVATAR_TYPES, MAX_AVATAR_BYTES } from '@/lib/constants';

export interface AvatarUploadProps {
  userId: string;
  name?: string | null;
  value: string | null;
  onChange: (url: string | null) => void;
}

/**
 * Uploads to the `avatars` bucket under `<userId>/<timestamp>.<ext>`, which is
 * the path shape the storage RLS policies require.
 */
export function AvatarUpload({ userId, name, value, onChange }: AvatarUploadProps) {
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
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path);

      // Drop the file this one replaces, otherwise every re-upload leaks an
      // object in a bucket nothing ever prunes.
      await removePreviousAvatar(supabase, userId, value);

      onChange(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        aria-label="Upload profile photo"
      >
        <Avatar src={value} name={name} size="xl" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="h-6 w-6 text-white" aria-hidden />
        </span>
      </button>

      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {value ? 'Change photo' : 'Upload photo'}
          </Button>
          {value && !uploading && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">JPG, PNG, or WebP. Max 2 MB.</p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

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

/**
 * Deletes the previous avatar object, given its public URL. Best-effort: a
 * failure here must not break an otherwise successful upload.
 */
async function removePreviousAvatar(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  previousUrl: string | null,
) {
  if (!previousUrl) return;

  const marker = '/storage/v1/object/public/avatars/';
  const index = previousUrl.indexOf(marker);
  if (index === -1) return;

  const path = decodeURIComponent(previousUrl.slice(index + marker.length)).split('?')[0];

  // Never issue a delete for a path outside the user's own folder.
  if (!path || !path.startsWith(`${userId}/`)) return;

  try {
    await supabase.storage.from('avatars').remove([path]);
  } catch {
    // Orphaned file at worst; not worth surfacing to the user.
  }
}

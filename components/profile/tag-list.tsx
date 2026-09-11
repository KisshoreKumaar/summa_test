import { Badge } from '@/components/ui/badge';

export function TagList({
  title,
  tags,
  tone = 'brand',
  emptyText,
}: {
  title: string;
  tags: string[];
  tone?: 'brand' | 'slate';
  emptyText?: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} tone={tone}>
              {tag}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{emptyText ?? 'Nothing added yet.'}</p>
      )}
    </div>
  );
}

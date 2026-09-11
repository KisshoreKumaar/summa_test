import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { ProfileCard } from '@/components/discover/profile-card';
import { getSuggestedPeople } from '@/lib/queries/discover';
import type { SuggestedPerson } from '@/lib/types/database';

/** Builds the "why am I seeing this" line under each suggestion. */
function matchReason(person: SuggestedPerson): string | undefined {
  const parts: string[] = [];
  if (person.shared_skills > 0) {
    parts.push(`${person.shared_skills} shared skill${person.shared_skills === 1 ? '' : 's'}`);
  }
  if (person.shared_interests > 0) {
    parts.push(
      `${person.shared_interests} shared interest${person.shared_interests === 1 ? '' : 's'}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export async function PeopleYouMayKnow({ limit = 6 }: { limit?: number }) {
  const people = await getSuggestedPeople(limit);

  if (people.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-brand-600" aria-hidden />
          People you may know
        </h2>
        <Link href="/discover" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          See all
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => (
          <ProfileCard
            key={person.id}
            person={person}
            /* Suggestions exclude anyone with an existing connection row. */
            connectionState={null}
            mutualConnections={person.mutual_connections}
            matchReason={matchReason(person)}
          />
        ))}
      </div>
    </section>
  );
}

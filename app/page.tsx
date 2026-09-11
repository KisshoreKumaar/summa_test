import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GraduationCap, MessagesSquare, Users, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/lib/queries/session';

const FEATURES = [
  { Icon: Users, title: 'Find your people', body: 'Search peers by branch, year, skills, and interests.' },
  { Icon: MessagesSquare, title: 'Start conversations', body: 'Connect and message students in your department.' },
  { Icon: CalendarDays, title: 'Stay in the loop', body: 'Groups, mentorship, and campus events in one place.' },
];

export default async function HomePage() {
  const user = await getSessionUser();

  if (user) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-white">
      <header className="container-page flex h-16 items-center justify-between">
        <span className="flex items-center gap-2 font-semibold text-slate-900">
          <GraduationCap className="h-6 w-6 text-brand-600" aria-hidden />
          Student Connect
        </span>
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      <main>
        <section className="container-page py-16 text-center sm:py-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Your department, actually connected.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Build a profile, discover students who share your skills and interests, and stay on top
            of everything happening in your department.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup">
              <Button size="lg">Create your profile</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                I already have an account
              </Button>
            </Link>
          </div>
        </section>

        <section className="container-page grid gap-6 pb-24 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-slate-200 p-6">
              <Icon className="h-6 w-6 text-brand-600" aria-hidden />
              <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

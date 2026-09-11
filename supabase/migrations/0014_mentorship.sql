-- ============================================================================
-- Phase 6 — Mentorship
--
-- Creates: mentors, mentorship_requests, mentor_availability, their RLS, the
-- booking RPCs, and the directory search.
-- ============================================================================

do $$ begin
  create type public.mentorship_status as enum
    ('requested', 'accepted', 'declined', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'mentorship_request';
  alter type public.notification_type add value if not exists 'mentorship_accepted';
exception when others then null; end $$;

-- ---------------------------------------------------------------------------
-- Seeking mentorship.
--
-- The spec's schema covers mentors but not the other half of "opt in as a
-- mentor or as someone seeking mentorship", so this is a flag on the profile
-- rather than a fourth table.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists seeking_mentorship boolean not null default false;

-- ---------------------------------------------------------------------------
-- mentors
-- ---------------------------------------------------------------------------
create table if not exists public.mentors (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  expertise  text[] not null default '{}',
  bio        text check (bio is null or char_length(bio) <= 800),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentors_expertise_idx on public.mentors using gin (expertise);
create index if not exists mentors_active_idx    on public.mentors (is_active);

drop trigger if exists mentors_set_updated_at on public.mentors;
create trigger mentors_set_updated_at
  before update on public.mentors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- mentor_availability
-- ---------------------------------------------------------------------------
create table if not exists public.mentor_availability (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.mentors (user_id) on delete cascade,
  slot_start timestamptz not null,
  slot_end   timestamptz not null,
  is_booked  boolean not null default false,
  -- Not in the spec's column list, but a booked slot has to record who booked it.
  booked_by  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint availability_time_order check (slot_end > slot_start),
  constraint availability_booked_shape check (
    (is_booked and booked_by is not null) or (not is_booked and booked_by is null)
  )
);

create index if not exists availability_mentor_idx
  on public.mentor_availability (mentor_id, slot_start);
create index if not exists availability_open_idx
  on public.mentor_availability (mentor_id, slot_start) where not is_booked;

-- ---------------------------------------------------------------------------
-- mentorship_requests
-- ---------------------------------------------------------------------------
create table if not exists public.mentorship_requests (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.mentors (user_id) on delete cascade,
  mentee_id  uuid not null references public.profiles (id) on delete cascade,
  message    text not null check (char_length(btrim(message)) between 1 and 1000),
  status     public.mentorship_status not null default 'requested',
  slot_id    uuid references public.mentor_availability (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentorship_no_self check (mentor_id <> mentee_id)
);

-- One live thread per pair; a completed or declined one can be reopened.
create unique index if not exists mentorship_open_pair_idx
  on public.mentorship_requests (mentor_id, mentee_id)
  where status in ('requested', 'accepted');

create index if not exists mentorship_mentor_idx on public.mentorship_requests (mentor_id, status);
create index if not exists mentorship_mentee_idx on public.mentorship_requests (mentee_id, status);

drop trigger if exists mentorship_set_updated_at on public.mentorship_requests;
create trigger mentorship_set_updated_at
  before update on public.mentorship_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_active_mentor(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.mentors m where m.user_id = uid and m.is_active);
$$;

create or replace function public.has_accepted_mentorship(mentor uuid, mentee uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mentorship_requests r
    where r.mentor_id = mentor and r.mentee_id = mentee and r.status = 'accepted'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS — mentors. Listing yourself in the directory is the consent to be seen.
-- ---------------------------------------------------------------------------
alter table public.mentors enable row level security;

drop policy if exists "mentors: read"   on public.mentors;
drop policy if exists "mentors: opt in" on public.mentors;
drop policy if exists "mentors: manage" on public.mentors;
drop policy if exists "mentors: leave"  on public.mentors;

create policy "mentors: read"
  on public.mentors for select
  to authenticated
  using (true);

create policy "mentors: opt in"
  on public.mentors for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "mentors: manage"
  on public.mentors for update
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_super_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_super_admin()));

create policy "mentors: leave"
  on public.mentors for delete
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- RLS — mentor_availability
--
-- Open slots are public so a mentee can see what there is to book. Who booked
-- a slot is visible only to the mentor and the person who booked it.
-- ---------------------------------------------------------------------------
alter table public.mentor_availability enable row level security;

drop policy if exists "availability: read"   on public.mentor_availability;
drop policy if exists "availability: offer"  on public.mentor_availability;
drop policy if exists "availability: adjust" on public.mentor_availability;
drop policy if exists "availability: remove" on public.mentor_availability;

create policy "availability: read"
  on public.mentor_availability for select
  to authenticated
  using (
    not is_booked
    or mentor_id = (select auth.uid())
    or booked_by = (select auth.uid())
    or (select public.is_super_admin())
  );

create policy "availability: offer"
  on public.mentor_availability for insert
  to authenticated
  with check (
    mentor_id = (select auth.uid())
    and not is_booked
    and booked_by is null
  );

-- The mentor edits their own slots. Booking goes through the RPC below, which
-- is why a mentee has no UPDATE policy here at all.
create policy "availability: adjust"
  on public.mentor_availability for update
  to authenticated
  using (mentor_id = (select auth.uid()))
  with check (mentor_id = (select auth.uid()));

create policy "availability: remove"
  on public.mentor_availability for delete
  to authenticated
  using (mentor_id = (select auth.uid()) or (select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- RLS — mentorship_requests
-- ---------------------------------------------------------------------------
alter table public.mentorship_requests enable row level security;

drop policy if exists "mentorship: read"    on public.mentorship_requests;
drop policy if exists "mentorship: ask"     on public.mentorship_requests;
drop policy if exists "mentorship: respond" on public.mentorship_requests;
drop policy if exists "mentorship: cancel"  on public.mentorship_requests;

create policy "mentorship: read"
  on public.mentorship_requests for select
  to authenticated
  using (
    mentee_id = (select auth.uid())
    or mentor_id = (select auth.uid())
    or (select public.is_super_admin())
  );

create policy "mentorship: ask"
  on public.mentorship_requests for insert
  to authenticated
  with check (
    mentee_id = (select auth.uid())
    and status = 'requested'
    and public.is_active_mentor(mentor_id)
  );

/*
 * The mentor decides. Either side may mark an accepted mentorship completed,
 * but nobody can reopen one: the OLD row must still be live.
 */
create policy "mentorship: respond"
  on public.mentorship_requests for update
  to authenticated
  using (
    status in ('requested', 'accepted')
    and (mentor_id = (select auth.uid()) or mentee_id = (select auth.uid()))
  )
  with check (
    (mentor_id = (select auth.uid()) and status in ('accepted', 'declined', 'completed'))
    or (mentee_id = (select auth.uid()) and status = 'completed')
  );

-- A mentee can withdraw a request they have sent.
create policy "mentorship: cancel"
  on public.mentorship_requests for delete
  to authenticated
  using (
    (mentee_id = (select auth.uid()) and status = 'requested')
    or (select public.is_super_admin())
  );

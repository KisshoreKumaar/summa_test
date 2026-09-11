-- ============================================================================
-- Phase 5 — Events & Announcements
--
-- Creates: events, event_rsvps, announcements, their RLS, and the reminder
-- notification for events you said you were going to.
-- ============================================================================

do $$ begin
  create type public.event_category as enum
    ('workshop', 'talk', 'competition', 'social', 'sports', 'cultural', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rsvp_status as enum ('going', 'interested', 'not_going');
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'event_reminder';
exception when others then null; end $$;

-- ---------------------------------------------------------------------------
-- Role helper. is_admin() covers club_admin and super_admin together; some
-- rules need to distinguish "runs the platform" from "runs a club".
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'super_admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 3 and 140),
  description text check (description is null or char_length(description) <= 2000),
  start_time  timestamptz not null,
  end_time    timestamptz,
  -- Either a room or a joining link; the UI renders it as a link when it parses
  -- as one. The spec keeps this a single field.
  location    text,
  cover_url   text,
  category    public.event_category not null default 'other',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_time_order check (end_time is null or end_time >= start_time)
);

create index if not exists events_start_idx    on public.events (start_time desc);
create index if not exists events_category_idx on public.events (category);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- event_rsvps
-- ---------------------------------------------------------------------------
create table if not exists public.event_rsvps (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     public.rsvp_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_rsvps_event_idx on public.event_rsvps (event_id, status);
create index if not exists event_rsvps_user_idx  on public.event_rsvps (user_id);

drop trigger if exists event_rsvps_set_updated_at on public.event_rsvps;
create trigger event_rsvps_set_updated_at
  before update on public.event_rsvps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(btrim(title)) between 3 and 140),
  content    text not null check (char_length(btrim(content)) between 1 and 5000),
  created_by uuid references public.profiles (id) on delete set null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_feed_idx
  on public.announcements (pinned desc, created_at desc);

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — events. Department-wide reading; only admins publish.
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;

drop policy if exists "events: read"   on public.events;
drop policy if exists "events: create" on public.events;
drop policy if exists "events: update" on public.events;
drop policy if exists "events: delete" on public.events;

create policy "events: read"
  on public.events for select
  to authenticated
  using (true);

create policy "events: create"
  on public.events for insert
  to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_admin()));

-- A club admin manages their own events; a super admin manages anyone's.
create policy "events: update"
  on public.events for update
  to authenticated
  using (
    (created_by = (select auth.uid()) and (select public.is_admin()))
    or (select public.is_super_admin())
  )
  with check (
    (created_by = (select auth.uid()) and (select public.is_admin()))
    or (select public.is_super_admin())
  );

create policy "events: delete"
  on public.events for delete
  to authenticated
  using (
    (created_by = (select auth.uid()) and (select public.is_admin()))
    or (select public.is_super_admin())
  );

-- ---------------------------------------------------------------------------
-- RLS — event_rsvps
--
-- Going and interested are public: an attendee count nobody can read is not a
-- count. "Not going" stays private to its owner, so declining is not a public
-- statement — and because only the public statuses are ever counted, counting
-- through RLS stays accurate.
-- ---------------------------------------------------------------------------
alter table public.event_rsvps enable row level security;

drop policy if exists "rsvps: read"   on public.event_rsvps;
drop policy if exists "rsvps: write"  on public.event_rsvps;
drop policy if exists "rsvps: change" on public.event_rsvps;
drop policy if exists "rsvps: clear"  on public.event_rsvps;

create policy "rsvps: read"
  on public.event_rsvps for select
  to authenticated
  using (
    status <> 'not_going'
    or user_id = (select auth.uid())
    -- Only the organiser of *this* event sees who declined it. is_admin() would
    -- have exposed every decline on the platform to every club admin.
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.created_by = (select auth.uid())
    )
    or (select public.is_super_admin())
  );

create policy "rsvps: write"
  on public.event_rsvps for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "rsvps: change"
  on public.event_rsvps for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "rsvps: clear"
  on public.event_rsvps for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS — announcements
-- ---------------------------------------------------------------------------
alter table public.announcements enable row level security;

drop policy if exists "announcements: read"   on public.announcements;
drop policy if exists "announcements: create" on public.announcements;
drop policy if exists "announcements: update" on public.announcements;
drop policy if exists "announcements: delete" on public.announcements;

create policy "announcements: read"
  on public.announcements for select
  to authenticated
  using (true);

create policy "announcements: create"
  on public.announcements for insert
  to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_admin()));

create policy "announcements: update"
  on public.announcements for update
  to authenticated
  using (
    (created_by = (select auth.uid()) and (select public.is_admin()))
    or (select public.is_super_admin())
  )
  with check (
    (created_by = (select auth.uid()) and (select public.is_admin()))
    or (select public.is_super_admin())
  );

create policy "announcements: delete"
  on public.announcements for delete
  to authenticated
  using (
    (created_by = (select auth.uid()) and (select public.is_admin()))
    or (select public.is_super_admin())
  );

-- ---------------------------------------------------------------------------
-- Event reminders
--
-- Supabase can run pg_cron, but a pull model needs no scheduler: the caller
-- generates their own reminders when they next open the app. The NOT EXISTS
-- guard makes it idempotent, so calling it repeatedly cannot spam anyone.
-- ---------------------------------------------------------------------------
create or replace function public.generate_event_reminders(lead_time interval default '24 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
  created int := 0;
begin
  if me is null then
    return 0;
  end if;

  insert into public.notifications (user_id, actor_id, type, entity_id)
  select me, e.created_by, 'event_reminder', e.id
  from public.events e
  join public.event_rsvps r
    on r.event_id = e.id and r.user_id = me and r.status = 'going'
  where e.start_time > now()
    and e.start_time <= now() + lead_time
    and not exists (
      select 1 from public.notifications n
      where n.user_id = me
        and n.type = 'event_reminder'
        and n.entity_id = e.id
    );

  get diagnostics created = row_count;
  return created;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage — event cover images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do nothing;

drop policy if exists "event covers: public read"  on storage.objects;
drop policy if exists "event covers: admin write"  on storage.objects;
drop policy if exists "event covers: admin update" on storage.objects;
drop policy if exists "event covers: admin delete" on storage.objects;

create policy "event covers: public read"
  on storage.objects for select
  using (bucket_id = 'event-covers');

create policy "event covers: admin write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_admin())
  );

create policy "event covers: admin update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "event covers: admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

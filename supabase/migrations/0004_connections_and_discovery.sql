-- ============================================================================
-- Phase 2 — Discovery / Search + Connections
--
-- Creates: connections, notifications, the RLS that governs them, and the
-- SQL used by discovery (search + "people you may know"). Also widens the
-- profiles read policy so `visibility = 'connections'` finally resolves.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.connection_status as enum ('pending', 'accepted', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum ('connection_request', 'connection_accepted');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- connections
-- ---------------------------------------------------------------------------
create table if not exists public.connections (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        public.connection_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint connections_no_self check (requester_id <> addressee_id)
);

-- One row per pair in either direction: blocks duplicates and the case where
-- both people send a request to each other.
create unique index if not exists connections_pair_idx
  on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists connections_requester_idx on public.connections (requester_id, status);
create index if not exists connections_addressee_idx on public.connections (addressee_id, status);

drop trigger if exists connections_set_updated_at on public.connections;
create trigger connections_set_updated_at
  before update on public.connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  type        public.notification_type not null,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- are_connected — SECURITY DEFINER so RLS on connections cannot recurse when
-- the profiles read policy calls it.
-- ---------------------------------------------------------------------------
create or replace function public.are_connected(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connections c
    where c.status = 'accepted'
      and ((c.requester_id = a and c.addressee_id = b)
        or (c.requester_id = b and c.addressee_id = a))
  );
$$;

-- ---------------------------------------------------------------------------
-- mutual_connection_count — returns a count only, never the underlying rows,
-- so running it as DEFINER does not leak anyone's connection list.
-- ---------------------------------------------------------------------------
create or replace function public.mutual_connection_count(target uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (select (select auth.uid()) as uid),
  mine as (
    select case when c.requester_id = v.uid then c.addressee_id else c.requester_id end as uid
    from public.connections c, viewer v
    where c.status = 'accepted' and v.uid in (c.requester_id, c.addressee_id)
  ),
  theirs as (
    select case when c.requester_id = target then c.addressee_id else c.requester_id end as uid
    from public.connections c
    where c.status = 'accepted' and target in (c.requester_id, c.addressee_id)
  )
  select count(*)::int from mine join theirs using (uid);
$$;

-- ---------------------------------------------------------------------------
-- RLS — connections
-- ---------------------------------------------------------------------------
alter table public.connections enable row level security;

drop policy if exists "connections: read own"    on public.connections;
drop policy if exists "connections: request"     on public.connections;
drop policy if exists "connections: respond"     on public.connections;
drop policy if exists "connections: withdraw"    on public.connections;
drop policy if exists "connections: admin read"  on public.connections;

-- Either party can see the row; nobody else can.
create policy "connections: read own"
  on public.connections for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "connections: admin read"
  on public.connections for select
  to authenticated
  using ((select public.is_admin()));

-- You may only create a pending request, only as yourself, and only toward an
-- active profile you are actually allowed to see.
create policy "connections: request"
  on public.connections for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = addressee_id and p.is_active
    )
  );

-- Only the addressee accepts or rejects. The requester cannot self-accept.
create policy "connections: respond"
  on public.connections for update
  to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status in ('accepted', 'rejected'));

-- Either party may delete: the requester cancels, either side disconnects.
create policy "connections: withdraw"
  on public.connections for delete
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- ---------------------------------------------------------------------------
-- RLS — notifications. Rows are written by a DEFINER trigger only, so there is
-- deliberately no INSERT policy for authenticated users.
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists "notifications: read own"      on public.notifications;
drop policy if exists "notifications: mark read"     on public.notifications;
drop policy if exists "notifications: delete own"    on public.notifications;

create policy "notifications: read own"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications: mark read"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notifications: delete own"
  on public.notifications for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Notification triggers
-- ---------------------------------------------------------------------------
create or replace function public.notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, entity_id)
  values (new.addressee_id, new.requester_id, 'connection_request', new.id);
  return new;
end;
$$;

drop trigger if exists connections_notify_request on public.connections;
create trigger connections_notify_request
  after insert on public.connections
  for each row
  when (new.status = 'pending')
  execute function public.notify_connection_request();

create or replace function public.notify_connection_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, entity_id)
  values (new.requester_id, new.addressee_id, 'connection_accepted', new.id);
  return new;
end;
$$;

drop trigger if exists connections_notify_accepted on public.connections;
create trigger connections_notify_accepted
  after update on public.connections
  for each row
  when (new.status = 'accepted' and old.status is distinct from 'accepted')
  execute function public.notify_connection_accepted();

-- ---------------------------------------------------------------------------
-- profiles read policy — now that connections exist, 'connections' visibility
-- can resolve properly instead of collapsing to owner-only.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: read visible" on public.profiles;
create policy "profiles: read visible"
  on public.profiles for select
  to authenticated
  using (
    is_active
    and id <> (select auth.uid())
    and (
      visibility = 'public'
      or (visibility = 'department' and public.same_branch(id))
      or (visibility = 'connections' and public.are_connected(id, (select auth.uid())))
    )
  );

-- ============================================================================
-- Phase 7 — Admin / moderation panel
--
-- Also closes a pre-existing escalation found while building this: `is_admin()`
-- covers club_admin *and* super_admin, and both the profiles update policy and
-- the privilege guard used it — so any club admin could promote themselves to
-- super_admin or deactivate anybody.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Escalation fix — role and is_active are super-admin territory.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;                       -- service role / server-side job
  end if;

  -- is_admin() includes club admins, who must not be able to grant roles.
  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'Not allowed to change role' using errcode = 'insufficient_privilege';
  end if;

  if new.is_active is distinct from old.is_active and not public.is_super_admin() then
    raise exception 'Not allowed to change is_active' using errcode = 'insufficient_privilege';
  end if;

  if new.id is distinct from old.id then
    raise exception 'Not allowed to change id' using errcode = 'insufficient_privilege';
  end if;

  if new.email is distinct from old.email
     and new.email is distinct from (select u.email from auth.users u where u.id = new.id) then
    raise exception 'Not allowed to change email' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop policy if exists "profiles: admin update" on public.profiles;
create policy "profiles: admin update"
  on public.profiles for update
  to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

-- Reading stays open to club admins: the moderation queue has to show them the
-- profile behind a report.

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.report_target_type as enum ('post', 'message', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('open', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target_type not null,
  target_id   uuid not null,
  reason      text not null check (char_length(btrim(reason)) between 3 and 1000),
  status      public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution  text,
  created_at  timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

-- One open report per person per target: re-reporting the same thing is noise.
create unique index if not exists reports_open_unique_idx
  on public.reports (reporter_id, target_type, target_id)
  where status = 'open';

alter table public.reports enable row level security;

drop policy if exists "reports: file"    on public.reports;
drop policy if exists "reports: read"    on public.reports;
drop policy if exists "reports: resolve" on public.reports;
drop policy if exists "reports: purge"   on public.reports;

create policy "reports: file"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');

-- Reporters can see what they filed; moderators see everything.
create policy "reports: read"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "reports: resolve"
  on public.reports for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "reports: purge"
  on public.reports for delete
  to authenticated
  using ((select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Moderation queue.
--
-- DEFINER so a moderator can see the reported content without being a member
-- of the group or a party to the conversation it sits in. Every function here
-- re-checks the caller's role rather than trusting the route guard.
-- ---------------------------------------------------------------------------
create or replace function public.admin_report_queue(
  filter_status public.report_status default 'open',
  page_limit int default 50
)
returns table (
  id             uuid,
  target_type    public.report_target_type,
  target_id      uuid,
  reason         text,
  status         public.report_status,
  created_at     timestamptz,
  reporter_id    uuid,
  reporter_name  text,
  target_preview text,
  target_author  uuid,
  target_exists  boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.status,
    r.created_at,
    r.reporter_id,
    rp.full_name,
    case r.target_type
      when 'post'    then (select left(gp.content, 300) from public.group_posts gp where gp.id = r.target_id)
      when 'message' then (select left(m.content, 300)  from public.messages m    where m.id = r.target_id)
      when 'user'    then (select p.full_name           from public.profiles p    where p.id = r.target_id)
    end,
    case r.target_type
      when 'post'    then (select gp.author_id from public.group_posts gp where gp.id = r.target_id)
      when 'message' then (select m.sender_id  from public.messages m    where m.id = r.target_id)
      when 'user'    then r.target_id
    end,
    case r.target_type
      when 'post'    then exists (select 1 from public.group_posts gp where gp.id = r.target_id)
      when 'message' then exists (select 1 from public.messages m    where m.id = r.target_id)
      when 'user'    then exists (select 1 from public.profiles p    where p.id = r.target_id)
    end
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  where public.is_admin()
    and r.status = filter_status
  order by r.created_at desc
  limit greatest(1, least(page_limit, 200));
$$;

create or replace function public.admin_resolve_report(
  report uuid,
  action text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_kind public.report_target_type;
  target      uuid;
begin
  if not public.is_admin() then
    raise exception 'Moderators only' using errcode = 'insufficient_privilege';
  end if;
  if action not in ('dismiss', 'resolve', 'remove') then
    raise exception 'Unknown action %', action using errcode = 'check_violation';
  end if;

  select r.target_type, r.target_id into target_kind, target
  from public.reports r where r.id = report;

  if target_kind is null then
    raise exception 'No such report' using errcode = 'check_violation';
  end if;

  -- 'remove' takes the content down as well as closing the report. Banning a
  -- user is deliberately not folded in here: that is a super-admin action with
  -- its own function.
  if action = 'remove' then
    if target_kind = 'post' then
      delete from public.group_posts where id = target;
    elsif target_kind = 'message' then
      delete from public.messages where id = target;
    else
      raise exception 'Use admin_set_user_active to act on a reported user'
        using errcode = 'check_violation';
    end if;
  end if;

  update public.reports
     set status = (case when action = 'dismiss' then 'dismissed' else 'resolved' end)::public.report_status,
         resolved_by = (select auth.uid()),
         resolved_at = now(),
         resolution = note
   where id = report;
end;
$$;

-- ---------------------------------------------------------------------------
-- User management — super admin only.
-- ---------------------------------------------------------------------------
create or replace function public.admin_user_list(
  q text default null,
  page_limit int default 30,
  page_offset int default 0
)
returns table (
  id            uuid,
  full_name     text,
  email         text,
  branch        text,
  year          smallint,
  role          public.user_role,
  is_active     boolean,
  onboarded_at  timestamptz,
  created_at    timestamptz,
  open_reports  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.full_name, p.email, p.branch, p.year, p.role, p.is_active,
    p.onboarded_at, p.created_at,
    (
      select count(*)::int from public.reports r
      where r.target_type = 'user' and r.target_id = p.id and r.status = 'open'
    )
  from public.profiles p
  where public.is_super_admin()
    and (
      q is null or btrim(q) = ''
      or p.full_name ilike '%' || btrim(q) || '%'
      or p.email ilike '%' || btrim(q) || '%'
    )
  order by p.created_at desc
  limit greatest(1, least(page_limit, 100))
  offset greatest(0, page_offset);
$$;

create or replace function public.admin_set_user_active(target uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admins only' using errcode = 'insufficient_privilege';
  end if;
  if target = (select auth.uid()) then
    raise exception 'You cannot deactivate your own account'
      using errcode = 'check_violation';
  end if;

  update public.profiles set is_active = active where id = target;
end;
$$;

create or replace function public.admin_set_user_role(target uuid, new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admins only' using errcode = 'insufficient_privilege';
  end if;

  -- Stepping down while you are the only super admin would lock the panel.
  if target = (select auth.uid()) and new_role <> 'super_admin' then
    if (select count(*) from public.profiles where role = 'super_admin' and is_active) <= 1 then
      raise exception 'Promote another super admin before stepping down'
        using errcode = 'check_violation';
    end if;
  end if;

  update public.profiles set role = new_role where id = target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private-group approval queue, across every group the caller administers.
-- ---------------------------------------------------------------------------
create or replace function public.admin_pending_group_requests()
returns table (
  group_id    uuid,
  group_name  text,
  user_id     uuid,
  full_name   text,
  avatar_url  text,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.name, m.user_id, p.full_name, p.avatar_url, m.created_at
  from public.group_members m
  join public.groups g on g.id = m.group_id
  join public.profiles p on p.id = m.user_id
  where m.status = 'pending'
    and (public.is_super_admin() or public.is_group_admin(g.id))
  order by m.created_at asc;
$$;

-- ---------------------------------------------------------------------------
-- Overview counters for the panel's landing page.
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
returns table (
  total_users     int,
  active_users    int,
  onboarded_users int,
  open_reports    int,
  pending_groups  int,
  total_groups    int,
  total_events    int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.profiles),
    (select count(*)::int from public.profiles where is_active),
    (select count(*)::int from public.profiles where onboarded_at is not null),
    (select count(*)::int from public.reports where status = 'open'),
    (select count(*)::int from public.group_members where status = 'pending'),
    (select count(*)::int from public.groups),
    (select count(*)::int from public.events)
  where public.is_admin();
$$;

-- ============================================================================
-- Phase 1 — Auth, Profiles, Onboarding
-- Creates: app_settings, enums, profiles, RLS policies, avatar storage bucket,
--          new-user trigger with college email-domain enforcement.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- App settings (server-side source of truth for the allowed signup domain).
-- The NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN env var mirrors this for client-side
-- validation only; this table is what actually enforces it.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('allowed_email_domain', 'college-domain.edu')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

-- Readable by any signed-in user; writable only through the service role.
drop policy if exists "app_settings readable by authenticated" on public.app_settings;
create policy "app_settings readable by authenticated"
  on public.app_settings for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.profile_visibility as enum ('public', 'department', 'connections');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('student', 'club_admin', 'super_admin');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  full_name       text,
  year            smallint check (year is null or year between 1 and 5),
  branch          text,
  bio             text check (bio is null or char_length(bio) <= 500),
  avatar_url      text,
  skills          text[] not null default '{}',
  interests       text[] not null default '{}',
  github_url      text,
  linkedin_url    text,
  portfolio_url   text,
  visibility      public.profile_visibility not null default 'department',
  role            public.user_role not null default 'student',
  onboarded_at    timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists profiles_branch_idx     on public.profiles (branch);
create index if not exists profiles_year_idx       on public.profiles (year);
create index if not exists profiles_skills_idx     on public.profiles using gin (skills);
create index if not exists profiles_interests_idx  on public.profiles using gin (interests);
create index if not exists profiles_full_name_idx  on public.profiles using gin (to_tsvector('simple', coalesce(full_name, '')));

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Signup handling: enforce the college email domain and create the profile row.
-- Runs as SECURITY DEFINER so it can read app_settings and write profiles.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_domain text;
  email_domain   text;
begin
  select value into allowed_domain
  from public.app_settings
  where key = 'allowed_email_domain';

  email_domain := lower(split_part(new.email, '@', 2));

  if allowed_domain is not null
     and allowed_domain <> ''
     and email_domain <> lower(allowed_domain) then
    raise exception 'Signups are restricted to @% email addresses', allowed_domain
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name',
                         new.raw_user_meta_data ->> 'name', '')), ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when a user changes their address.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Helper predicates used by RLS (SECURITY DEFINER avoids recursive RLS reads)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role in ('club_admin', 'super_admin')
  );
$$;

create or replace function public.same_branch(target uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles me, public.profiles them
    where me.id = uid
      and them.id = target
      and me.branch is not null
      and me.branch = them.branch
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS — profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own"        on public.profiles;
drop policy if exists "profiles: read visible"    on public.profiles;
drop policy if exists "profiles: insert own"      on public.profiles;
drop policy if exists "profiles: update own"      on public.profiles;
drop policy if exists "profiles: admin read all"  on public.profiles;
drop policy if exists "profiles: admin update"    on public.profiles;

-- Always read your own row.
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Read other people's rows subject to their visibility setting.
-- 'connections' is intentionally restrictive until Phase 2 adds the
-- connections table; it resolves to owner-only for now.
create policy "profiles: read visible"
  on public.profiles for select
  to authenticated
  using (
    is_active
    and id <> (select auth.uid())
    and (
      visibility = 'public'
      or (visibility = 'department' and public.same_branch(id))
    )
  );

create policy "profiles: admin read all"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()));

-- The trigger creates the row, but allow a self-insert as a fallback.
-- The trigger normally creates this row. The self-insert fallback must not be
-- a privilege-escalation path, so a user may only insert themselves as an
-- ordinary active student; the UPDATE guard below covers changes after that.
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and role = 'student'::public.user_role
    and is_active
  );

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles: admin update"
  on public.profiles for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Privilege escalation guard: a user may not change their own role or
-- reactivate a banned account. Admin changes go through the service role.
-- SECURITY DEFINER so the email check can read auth.users. Note that
-- SECURITY DEFINER does *not* clear auth.uid(): it reads the request's JWT
-- claim, so the checks below still apply to the calling user.
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

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Not allowed to change role' using errcode = 'insufficient_privilege';
  end if;

  if new.is_active is distinct from old.is_active and not public.is_admin() then
    raise exception 'Not allowed to change is_active' using errcode = 'insufficient_privilege';
  end if;

  if new.id is distinct from old.id then
    raise exception 'Not allowed to change id' using errcode = 'insufficient_privilege';
  end if;

  /*
   * profiles.email mirrors auth.users.email. handle_user_email_change() must be
   * able to sync it, but nobody may set it to an arbitrary value. Comparing
   * against auth.users (already updated, since that trigger fires AFTER) lets
   * the sync through and rejects everything else.
   */
  if new.email is distinct from old.email
     and new.email is distinct from (
       select u.email from auth.users u where u.id = new.id
     ) then
    raise exception 'Not allowed to change email' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------------
-- Storage — avatars bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars: public read"   on storage.objects;
drop policy if exists "avatars: owner insert"  on storage.objects;
drop policy if exists "avatars: owner update"  on storage.objects;
drop policy if exists "avatars: owner delete"  on storage.objects;

create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Files must live under a folder named after the owner's uid: avatars/<uid>/file.png
create policy "avatars: owner insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Phase 3 — Group automation
--   * whoever creates a group becomes its owner
--   * students are auto-enrolled in a batch group for their year + branch
--   * join requests and approvals raise notifications
--   * the group-covers storage bucket
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Creator becomes owner.
--
-- Runs as DEFINER because the self-join policy deliberately refuses to let
-- anyone insert themselves with role 'owner'.
-- ---------------------------------------------------------------------------
create or replace function public.handle_group_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.group_members (group_id, user_id, role, status)
    values (new.id, new.created_by, 'owner', 'active')
    on conflict (group_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists groups_add_owner on public.groups;
create trigger groups_add_owner
  after insert on public.groups
  for each row execute function public.handle_group_created();

-- ---------------------------------------------------------------------------
-- Batch groups.
--
-- The spec says "auto-generated batch groups on signup", but year and branch
-- are not known at signup — they are collected during onboarding. So this runs
-- whenever a profile gains or changes year/branch, which covers finishing
-- onboarding, editing a profile, and moving up a year.
-- ---------------------------------------------------------------------------
create or replace function public.sync_batch_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid   uuid;
  gname text;
begin
  if new.onboarded_at is null or new.year is null or new.branch is null then
    return new;
  end if;

  -- Drop out of any batch group that no longer matches.
  delete from public.group_members m
  using public.groups g
  where m.user_id = new.id
    and m.group_id = g.id
    and g.category = 'batch'
    and (g.batch_branch is distinct from new.branch or g.batch_year is distinct from new.year);

  gname := new.branch || ' — Year ' || new.year;

  select g.id into gid
  from public.groups g
  where g.category = 'batch' and g.batch_branch = new.branch and g.batch_year = new.year;

  if gid is null then
    insert into public.groups (name, description, type, category, batch_branch, batch_year)
    values (
      gname,
      'Everyone studying ' || new.branch || ' in year ' || new.year || '.',
      'public',
      'batch',
      new.branch,
      new.year
    )
    on conflict (batch_branch, batch_year) where category = 'batch' do nothing
    returning id into gid;

    -- Lost the race with a concurrent signup; take the row that won.
    if gid is null then
      select g.id into gid
      from public.groups g
      where g.category = 'batch' and g.batch_branch = new.branch and g.batch_year = new.year;
    end if;
  end if;

  if gid is not null then
    insert into public.group_members (group_id, user_id, role, status)
    values (gid, new.id, 'member', 'active')
    on conflict (group_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_batch_group on public.profiles;
create trigger profiles_sync_batch_group
  after insert or update of year, branch, onboarded_at on public.profiles
  for each row execute function public.sync_batch_group();

-- ---------------------------------------------------------------------------
-- Join-request notifications
-- ---------------------------------------------------------------------------
create or replace function public.notify_group_join_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Every admin of the group hears about a pending request.
  insert into public.notifications (user_id, actor_id, type, entity_id)
  select m.user_id, new.user_id, 'group_join_request', new.group_id
  from public.group_members m
  where m.group_id = new.group_id
    and m.status = 'active'
    and m.role in ('owner', 'admin')
    and m.user_id <> new.user_id;

  return new;
end;
$$;

drop trigger if exists group_members_notify_request on public.group_members;
create trigger group_members_notify_request
  after insert on public.group_members
  for each row
  when (new.status = 'pending')
  execute function public.notify_group_join_request();

create or replace function public.notify_group_join_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, entity_id)
  values (new.user_id, (select auth.uid()), 'group_join_approved', new.group_id);
  return new;
end;
$$;

drop trigger if exists group_members_notify_approved on public.group_members;
create trigger group_members_notify_approved
  after update on public.group_members
  for each row
  when (new.status = 'active' and old.status is distinct from 'active')
  execute function public.notify_group_join_approved();

-- ---------------------------------------------------------------------------
-- Storage — group cover images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('group-covers', 'group-covers', true)
on conflict (id) do nothing;

drop policy if exists "group covers: public read"  on storage.objects;
drop policy if exists "group covers: owner write"  on storage.objects;
drop policy if exists "group covers: owner update" on storage.objects;
drop policy if exists "group covers: owner delete" on storage.objects;

create policy "group covers: public read"
  on storage.objects for select
  using (bucket_id = 'group-covers');

-- Same convention as avatars: files live under a folder named for the uploader.
create policy "group covers: owner write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'group-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "group covers: owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'group-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'group-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "group covers: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'group-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

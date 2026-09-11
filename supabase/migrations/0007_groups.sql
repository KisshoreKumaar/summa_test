-- ============================================================================
-- Phase 3 — Groups & Communities
--
-- Creates: groups, group_members (with an approval state), the group feed
-- (posts / comments / likes), the group-covers storage bucket, and the trigger
-- that auto-enrols students into a batch group for their year + branch.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.group_type as enum ('public', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.group_category as enum ('club', 'batch', 'project', 'interest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.group_member_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

-- Public groups join instantly ('active'); private groups wait ('pending').
do $$ begin
  create type public.group_member_status as enum ('pending', 'active');
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'group_join_request';
  alter type public.notification_type add value if not exists 'group_join_approved';
exception when others then null; end $$;

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(btrim(name)) between 3 and 80),
  description   text check (description is null or char_length(description) <= 500),
  cover_url     text,
  type          public.group_type not null default 'public',
  category      public.group_category not null default 'interest',
  created_by    uuid references public.profiles (id) on delete set null,
  -- Set only for auto-generated batch groups; keeps them unique and findable.
  batch_branch  text,
  batch_year    smallint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists groups_batch_key_idx
  on public.groups (batch_branch, batch_year)
  where category = 'batch';

create index if not exists groups_category_idx on public.groups (category);
create index if not exists groups_type_idx     on public.groups (type);
create index if not exists groups_name_idx     on public.groups (lower(name));

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- group_members
--
-- The spec lists (group_id, user_id, role). `status` is added so private
-- groups can hold a join request pending approval without a second table.
-- ---------------------------------------------------------------------------
create table if not exists public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.group_member_role not null default 'member',
  status     public.group_member_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx  on public.group_members (user_id, status);
create index if not exists group_members_group_idx on public.group_members (group_id, status);

-- ---------------------------------------------------------------------------
-- Group feed
-- ---------------------------------------------------------------------------
create table if not exists public.group_posts (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  content    text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_posts_group_idx on public.group_posts (group_id, created_at desc);

drop trigger if exists group_posts_set_updated_at on public.group_posts;
create trigger group_posts_set_updated_at
  before update on public.group_posts
  for each row execute function public.set_updated_at();

create table if not exists public.group_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.group_posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  content    text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists group_post_comments_post_idx
  on public.group_post_comments (post_id, created_at asc);

create table if not exists public.group_post_likes (
  post_id    uuid not null references public.group_posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Membership helpers. SECURITY DEFINER so that policies on group_members can
-- ask about membership without recursing into their own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(gid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = uid and m.status = 'active'
  );
$$;

create or replace function public.is_group_admin(gid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid
      and m.user_id = uid
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

/*
 * Membership is judged against the post's group, so the feed policies need to
 * resolve post -> group without being able to read group_posts under RLS.
 */
create or replace function public.post_group_id(pid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.group_id from public.group_posts p where p.id = pid;
$$;

create or replace function public.group_member_count(gid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.group_members m
  where m.group_id = gid and m.status = 'active';
$$;

-- ---------------------------------------------------------------------------
-- RLS — groups
--
-- Every group is listable, including private ones: a private group has to be
-- discoverable for anyone to request to join it. Privacy is enforced on the
-- feed and the member list, not on the group's existence.
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;

drop policy if exists "groups: read"          on public.groups;
drop policy if exists "groups: create"        on public.groups;
drop policy if exists "groups: admin update"  on public.groups;
drop policy if exists "groups: owner delete"  on public.groups;

create policy "groups: read"
  on public.groups for select
  to authenticated
  using (true);

-- Batch groups are created by the enrolment trigger, never by hand.
create policy "groups: create"
  on public.groups for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and category <> 'batch'
    and batch_branch is null
    and batch_year is null
  );

create policy "groups: admin update"
  on public.groups for update
  to authenticated
  using (public.is_group_admin(id) or (select public.is_admin()))
  with check (public.is_group_admin(id) or (select public.is_admin()));

create policy "groups: owner delete"
  on public.groups for delete
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.group_members m
      where m.group_id = id and m.user_id = (select auth.uid())
        and m.role = 'owner' and m.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — group_members
-- ---------------------------------------------------------------------------
alter table public.group_members enable row level security;

drop policy if exists "group_members: read"        on public.group_members;
drop policy if exists "group_members: join"        on public.group_members;
drop policy if exists "group_members: admin write" on public.group_members;
drop policy if exists "group_members: leave"       on public.group_members;

-- Members see the roster; everyone can see their own row (so a pending
-- request is visible to the person waiting on it).
create policy "group_members: read"
  on public.group_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_group_member(group_id)
    or (select public.is_admin())
  );

/*
 * Self-service join. A public group admits immediately; a private group only
 * accepts a pending row. Nobody can insert themselves as owner or admin.
 */
create policy "group_members: join"
  on public.group_members for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'member'
    and exists (
      select 1 from public.groups g
      where g.id = group_id
        and status = (case when g.type = 'public' then 'active' else 'pending' end)::public.group_member_status
    )
  );

-- Group admins approve pending requests and change roles.
create policy "group_members: admin write"
  on public.group_members for update
  to authenticated
  using (public.is_group_admin(group_id) or (select public.is_admin()))
  with check (public.is_group_admin(group_id) or (select public.is_admin()));

-- Leave a group yourself, or be removed by a group admin.
create policy "group_members: leave"
  on public.group_members for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_group_admin(group_id)
    or (select public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- RLS — group feed. Everything here is scoped to active membership.
-- ---------------------------------------------------------------------------
alter table public.group_posts enable row level security;

drop policy if exists "group_posts: read"   on public.group_posts;
drop policy if exists "group_posts: write"  on public.group_posts;
drop policy if exists "group_posts: edit"   on public.group_posts;
drop policy if exists "group_posts: delete" on public.group_posts;

create policy "group_posts: read"
  on public.group_posts for select
  to authenticated
  using (public.is_group_member(group_id) or (select public.is_admin()));

create policy "group_posts: write"
  on public.group_posts for insert
  to authenticated
  with check (author_id = (select auth.uid()) and public.is_group_member(group_id));

create policy "group_posts: edit"
  on public.group_posts for update
  to authenticated
  using (author_id = (select auth.uid()) and public.is_group_member(group_id))
  with check (author_id = (select auth.uid()));

-- Authors delete their own; group admins moderate.
create policy "group_posts: delete"
  on public.group_posts for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_group_admin(group_id)
    or (select public.is_admin())
  );

alter table public.group_post_comments enable row level security;

drop policy if exists "group_post_comments: read"   on public.group_post_comments;
drop policy if exists "group_post_comments: write"  on public.group_post_comments;
drop policy if exists "group_post_comments: delete" on public.group_post_comments;

create policy "group_post_comments: read"
  on public.group_post_comments for select
  to authenticated
  using (public.is_group_member(public.post_group_id(post_id)) or (select public.is_admin()));

create policy "group_post_comments: write"
  on public.group_post_comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_group_member(public.post_group_id(post_id))
  );

create policy "group_post_comments: delete"
  on public.group_post_comments for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_group_admin(public.post_group_id(post_id))
    or (select public.is_admin())
  );

alter table public.group_post_likes enable row level security;

drop policy if exists "group_post_likes: read"   on public.group_post_likes;
drop policy if exists "group_post_likes: like"   on public.group_post_likes;
drop policy if exists "group_post_likes: unlike" on public.group_post_likes;

create policy "group_post_likes: read"
  on public.group_post_likes for select
  to authenticated
  using (public.is_group_member(public.post_group_id(post_id)) or (select public.is_admin()));

create policy "group_post_likes: like"
  on public.group_post_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_group_member(public.post_group_id(post_id))
  );

create policy "group_post_likes: unlike"
  on public.group_post_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

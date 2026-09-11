-- ============================================================================
-- Phase 4 — Messaging
--
-- Creates: conversations, conversation_participants, messages, the RLS that
-- governs them, and the RPCs the UI needs (open a DM, list conversations,
-- mark read). Registers `messages` with the Realtime publication.
-- ============================================================================

do $$ begin
  create type public.conversation_type as enum ('dm', 'group');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  type       public.conversation_type not null,
  group_id   uuid references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A group conversation must name its group; a DM must not.
  constraint conversations_group_shape check (
    (type = 'group' and group_id is not null)
    or (type = 'dm' and group_id is null)
  )
);

-- One chat per group.
create unique index if not exists conversations_group_idx
  on public.conversations (group_id) where type = 'group';

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- conversation_participants
--
-- Used for DMs only. Group conversations derive their membership from
-- group_members, so leaving a group cannot leave a stale participant row
-- behind that still grants access to the chat.
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  content         text not null check (char_length(btrim(content)) between 1 and 4000),
  read_by         uuid[] not null default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Access helpers. SECURITY DEFINER so policies can ask these questions without
-- recursing through the very tables they protect.
-- ---------------------------------------------------------------------------
create or replace function public.is_conversation_participant(cid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = cid
      and (
        (c.type = 'dm' and exists (
          select 1 from public.conversation_participants p
          where p.conversation_id = c.id and p.user_id = uid
        ))
        or (c.type = 'group' and public.is_group_member(c.group_id, uid))
      )
  );
$$;

/*
 * Reading history and sending are different questions. A DM stays readable
 * after two people disconnect, but sending requires a live connection — that
 * is what "restricted to users who are connected" has to mean once either side
 * can withdraw.
 */
create or replace function public.can_post_to_conversation(cid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case c.type
    when 'group' then public.is_group_member(c.group_id, uid)
    when 'dm' then
      exists (
        select 1 from public.conversation_participants p
        where p.conversation_id = c.id and p.user_id = uid
      )
      and exists (
        select 1 from public.conversation_participants o
        where o.conversation_id = c.id
          and o.user_id <> uid
          and public.are_connected(o.user_id, uid)
      )
  end
  from public.conversations c
  where c.id = cid;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;

drop policy if exists "conversations: read" on public.conversations;
create policy "conversations: read"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_participant(id) or (select public.is_admin()));

-- Conversations are only ever created through the RPCs below, which check
-- eligibility first. There is deliberately no INSERT policy.

alter table public.conversation_participants enable row level security;

drop policy if exists "participants: read" on public.conversation_participants;
create policy "participants: read"
  on public.conversation_participants for select
  to authenticated
  using (public.is_conversation_participant(conversation_id) or (select public.is_admin()));

alter table public.messages enable row level security;

drop policy if exists "messages: read"   on public.messages;
drop policy if exists "messages: send"   on public.messages;
drop policy if exists "messages: delete" on public.messages;

create policy "messages: read"
  on public.messages for select
  to authenticated
  using (public.is_conversation_participant(conversation_id) or (select public.is_admin()));

create policy "messages: send"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.can_post_to_conversation(conversation_id)
  );

-- Senders may retract their own message; there is no UPDATE policy at all, so
-- content cannot be rewritten and read_by can only move through the RPC below.
create policy "messages: delete"
  on public.messages for delete
  to authenticated
  using (sender_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Opening conversations
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_dm(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := (select auth.uid());
  cid uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if other_user = me then
    raise exception 'You cannot message yourself' using errcode = 'check_violation';
  end if;
  if not public.are_connected(me, other_user) then
    raise exception 'You can only message people you are connected with'
      using errcode = 'insufficient_privilege';
  end if;

  -- Existing thread between exactly these two, in either direction.
  select c.id into cid
  from public.conversations c
  join public.conversation_participants a on a.conversation_id = c.id and a.user_id = me
  join public.conversation_participants b on b.conversation_id = c.id and b.user_id = other_user
  where c.type = 'dm'
  limit 1;

  if cid is not null then
    return cid;
  end if;

  insert into public.conversations (type) values ('dm') returning id into cid;
  insert into public.conversation_participants (conversation_id, user_id)
  values (cid, me), (cid, other_user);

  return cid;
end;
$$;

create or replace function public.get_or_create_group_conversation(gid uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if not public.is_group_member(gid) then
    raise exception 'Only group members can open the group chat'
      using errcode = 'insufficient_privilege';
  end if;

  select c.id into cid from public.conversations c
  where c.type = 'group' and c.group_id = gid;

  if cid is not null then
    return cid;
  end if;

  insert into public.conversations (type, group_id) values ('group', gid)
  on conflict (group_id) where type = 'group' do nothing
  returning id into cid;

  -- Lost the race with a concurrent opener; take the row that won.
  if cid is null then
    select c.id into cid from public.conversations c
    where c.type = 'group' and c.group_id = gid;
  end if;

  return cid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read state. There is no UPDATE policy on messages, so this DEFINER function
-- is the only way read_by can change — and it can only ever append the caller.
-- ---------------------------------------------------------------------------
create or replace function public.mark_conversation_read(cid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not public.is_conversation_participant(cid, me) then
    return;
  end if;

  update public.messages
     set read_by = array_append(read_by, me)
   where conversation_id = cid
     and sender_id <> me
     and not (me = any(read_by));
end;
$$;

-- ---------------------------------------------------------------------------
-- Conversation list: last-message preview plus unread count.
--
-- DEFINER, but every row is filtered to conversations the caller participates
-- in. It returns only the counterpart's name and avatar, which the caller can
-- already see — a DM partner is by definition connected.
-- ---------------------------------------------------------------------------
create or replace function public.list_conversations()
returns table (
  conversation_id uuid,
  type            text,
  group_id        uuid,
  title           text,
  avatar_url      text,
  other_user_id   uuid,
  last_message    text,
  last_sender_id  uuid,
  last_message_at timestamptz,
  unread_count    int
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select (select auth.uid()) as uid),
  mine as (
    select c.*
    from public.conversations c, me
    where public.is_conversation_participant(c.id, me.uid)
  ),
  counterpart as (
    select p.conversation_id, p.user_id
    from public.conversation_participants p, me
    where p.user_id <> me.uid
  ),
  last_msg as (
    select distinct on (m.conversation_id)
      m.conversation_id, m.content, m.sender_id, m.created_at
    from public.messages m
    where m.conversation_id in (select id from mine)
    order by m.conversation_id, m.created_at desc
  )
  select
    mine.id,
    mine.type::text,
    mine.group_id,
    coalesce(g.name, pr.full_name, 'Conversation'),
    coalesce(g.cover_url, pr.avatar_url),
    cp.user_id,
    lm.content,
    lm.sender_id,
    lm.created_at,
    (
      select count(*)::int from public.messages um, me
      where um.conversation_id = mine.id
        and um.sender_id <> me.uid
        and not (me.uid = any(um.read_by))
    )
  from mine
  left join counterpart cp on cp.conversation_id = mine.id
  left join public.profiles pr on pr.id = cp.user_id
  left join public.groups g on g.id = mine.group_id
  left join last_msg lm on lm.conversation_id = mine.id
  order by coalesce(lm.created_at, mine.created_at) desc;
$$;

-- ---------------------------------------------------------------------------
-- Realtime. Guarded so the migration also runs on a plain Postgres, which has
-- no supabase_realtime publication.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;
  end if;
end $$;

-- ============================================================================
-- 0011 — Phase 4 audit fixes
--
--   1. Group chat could not be moderated. A group admin can delete any post in
--      the group feed but not a message in the group chat, so the faster of the
--      two surfaces was the one nobody could police.
--   4. get_or_create_dm() created the conversation on click, so opening a DM
--      and never writing still put an empty thread in the other person's list.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- #1 — Group admins moderate their own group's chat.
--
-- A DEFINER helper keeps the messages policy from depending on a nested read
-- of `conversations`, which carries its own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.can_moderate_conversation(cid uuid, uid uuid default auth.uid())
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
      and c.type = 'group'
      and public.is_group_admin(c.group_id, uid)
  );
$$;

drop policy if exists "messages: delete" on public.messages;
create policy "messages: delete"
  on public.messages for delete
  to authenticated
  using (
    sender_id = (select auth.uid())
    or public.can_moderate_conversation(conversation_id)
    or (select public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- #4 — Record who opened a conversation, so an unused DM stays private to the
-- person who opened it until they actually send something.
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

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

  select c.id into cid
  from public.conversations c
  join public.conversation_participants a on a.conversation_id = c.id and a.user_id = me
  join public.conversation_participants b on b.conversation_id = c.id and b.user_id = other_user
  where c.type = 'dm'
  limit 1;

  if cid is not null then
    return cid;
  end if;

  insert into public.conversations (type, created_by) values ('dm', me) returning id into cid;
  insert into public.conversation_participants (conversation_id, user_id)
  values (cid, me), (cid, other_user);

  return cid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conversation list — same shape, but an empty DM is only visible to whoever
-- opened it. Group conversations always show: being in the group is reason
-- enough to see its chat.
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
      and p.conversation_id in (select id from mine)
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
  cross join me
  left join counterpart cp on cp.conversation_id = mine.id
  left join public.profiles pr on pr.id = cp.user_id
  left join public.groups g on g.id = mine.group_id
  left join last_msg lm on lm.conversation_id = mine.id
  where mine.type = 'group'
     or lm.created_at is not null
     or mine.created_by is not distinct from me.uid
  order by coalesce(lm.created_at, mine.created_at) desc;
$$;

-- ============================================================================
-- 0019 — Phase 7 audit fixes
--
--   1. `is_admin()` covers club admins as well as super admins, and a bare
--      `is_admin()` branch sat in the group, connection, and messaging
--      policies. A club admin could take ownership of any group, rename or
--      delete any group, and read every direct message on the platform.
--   2. The reports insert policy never checked that the reporter could see the
--      target, and admin_report_queue is SECURITY DEFINER — so a guessed
--      message id surfaced a private DM to the moderation queue.
--   3. Reports could point at rows that do not exist.
--
-- 0018 fixed this class for `profiles`. These are the rest of them.
--
-- Moderation still works: admin_resolve_report is SECURITY DEFINER, so a club
-- admin removing reported content does not rely on any of these policies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------
drop policy if exists "groups: admin update" on public.groups;
create policy "groups: admin update"
  on public.groups for update
  to authenticated
  using (public.is_group_admin(id) or (select public.is_super_admin()))
  with check (public.is_group_admin(id) or (select public.is_super_admin()));

drop policy if exists "groups: owner delete" on public.groups;
create policy "groups: owner delete"
  on public.groups for delete
  to authenticated
  using (
    (select public.is_super_admin())
    or exists (
      select 1 from public.group_members m
      where m.group_id = id and m.user_id = (select auth.uid())
        and m.role = 'owner' and m.status = 'active'
    )
  );

-- The owner guard from 0009 stays; only the escape hatch changes.
drop policy if exists "group_members: admin write" on public.group_members;
create policy "group_members: admin write"
  on public.group_members for update
  to authenticated
  using (
    (select public.is_super_admin())
    or (role <> 'owner' and public.is_group_admin(group_id))
  )
  with check (
    (select public.is_super_admin())
    or (role <> 'owner' and public.is_group_admin(group_id))
  );

drop policy if exists "group_members: leave" on public.group_members;
create policy "group_members: leave"
  on public.group_members for delete
  to authenticated
  using (
    (select public.is_super_admin())
    or (
      role <> 'owner'
      and (
        user_id = (select auth.uid())
        or public.is_group_admin(group_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Group feed — a club admin has no business reading a private group's posts.
-- ---------------------------------------------------------------------------
drop policy if exists "group_posts: read" on public.group_posts;
create policy "group_posts: read"
  on public.group_posts for select
  to authenticated
  using (public.is_group_member(group_id) or (select public.is_super_admin()));

drop policy if exists "group_posts: delete" on public.group_posts;
create policy "group_posts: delete"
  on public.group_posts for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_group_admin(group_id)
    or (select public.is_super_admin())
  );

drop policy if exists "group_post_comments: read" on public.group_post_comments;
create policy "group_post_comments: read"
  on public.group_post_comments for select
  to authenticated
  using (
    public.is_group_member(public.post_group_id(post_id))
    or (select public.is_super_admin())
  );

drop policy if exists "group_post_comments: delete" on public.group_post_comments;
create policy "group_post_comments: delete"
  on public.group_post_comments for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_group_admin(public.post_group_id(post_id))
    or (select public.is_super_admin())
  );

drop policy if exists "group_post_likes: read" on public.group_post_likes;
create policy "group_post_likes: read"
  on public.group_post_likes for select
  to authenticated
  using (
    public.is_group_member(public.post_group_id(post_id))
    or (select public.is_super_admin())
  );

-- ---------------------------------------------------------------------------
-- Connections and messaging
-- ---------------------------------------------------------------------------
drop policy if exists "connections: admin read" on public.connections;
create policy "connections: admin read"
  on public.connections for select
  to authenticated
  using ((select public.is_super_admin()));

drop policy if exists "conversations: read" on public.conversations;
create policy "conversations: read"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_participant(id) or (select public.is_super_admin()));

drop policy if exists "participants: read" on public.conversation_participants;
create policy "participants: read"
  on public.conversation_participants for select
  to authenticated
  using (
    public.is_conversation_participant(conversation_id)
    or (select public.is_super_admin())
  );

drop policy if exists "messages: read" on public.messages;
create policy "messages: read"
  on public.messages for select
  to authenticated
  using (
    public.is_conversation_participant(conversation_id)
    or (select public.is_super_admin())
  );

drop policy if exists "messages: delete" on public.messages;
create policy "messages: delete"
  on public.messages for delete
  to authenticated
  using (
    sender_id = (select auth.uid())
    or public.can_moderate_conversation(conversation_id)
    or (select public.is_super_admin())
  );

-- ---------------------------------------------------------------------------
-- #2 and #3 — You may only report something you can actually see.
--
-- DEFINER because the visibility helpers are, and because it has to answer for
-- rows the caller cannot read. It returns a boolean used only to *deny*, so it
-- reveals nothing beyond "can I see this", which the caller already knows.
-- ---------------------------------------------------------------------------
create or replace function public.can_report_target(
  kind public.report_target_type,
  target uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case kind
    when 'post' then public.is_group_member(public.post_group_id(target))
    when 'message' then public.is_conversation_participant(
      (select m.conversation_id from public.messages m where m.id = target)
    )
    when 'user' then exists (
      select 1 from public.profiles p where p.id = target and p.is_active
    )
  end;
$$;

drop policy if exists "reports: file" on public.reports;
create policy "reports: file"
  on public.reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'
    and public.can_report_target(target_type, target_id)
  );

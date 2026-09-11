-- ============================================================================
-- 0009 — Phase 3 audit fixes
--
--   1. A group admin could promote themselves to owner, demote the owner, or
--      remove the owner outright — a complete group takeover. The old policies
--      authorised the *actor* but never constrained the *mutation*.
--   2. An owner could delete their own membership row, leaving the group with
--      nobody able to administer it.
--   3. Member counts read through group_members RLS, so a non-member counted
--      zero rows and every group they had not joined displayed "0 members".
--
-- Because owners are now pinned in place, ownership transfer becomes a real
-- operation rather than something the app pretends exists.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- #1 — Nobody may write an owner row, and nobody may mint a new owner.
--
-- On UPDATE, `using` sees the OLD row and `with check` sees the NEW one, so
-- both sides need the guard: OLD blocks touching the current owner, NEW blocks
-- creating another one. Platform super-admins keep full latitude.
-- ---------------------------------------------------------------------------
drop policy if exists "group_members: admin write" on public.group_members;
create policy "group_members: admin write"
  on public.group_members for update
  to authenticated
  using (
    (select public.is_admin())
    or (role <> 'owner' and public.is_group_admin(group_id))
  )
  with check (
    (select public.is_admin())
    or (role <> 'owner' and public.is_group_admin(group_id))
  );

-- ---------------------------------------------------------------------------
-- #2 — An owner cannot delete their own membership, and an admin cannot delete
-- the owner's. Everyone else may still leave, and admins may still remove
-- ordinary members.
-- ---------------------------------------------------------------------------
drop policy if exists "group_members: leave" on public.group_members;
create policy "group_members: leave"
  on public.group_members for delete
  to authenticated
  using (
    (select public.is_admin())
    or (
      role <> 'owner'
      and (
        user_id = (select auth.uid())
        or public.is_group_admin(group_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Ownership transfer.
--
-- SECURITY DEFINER because the policies above now forbid writing owner rows
-- from application context. The function is the only sanctioned path, and it
-- verifies the caller is the current owner before doing anything.
-- ---------------------------------------------------------------------------
create or replace function public.transfer_group_ownership(gid uuid, new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = caller
      and m.role = 'owner' and m.status = 'active'
  ) then
    raise exception 'Only the group owner can transfer ownership'
      using errcode = 'insufficient_privilege';
  end if;

  if new_owner = caller then
    return;
  end if;

  if not exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = new_owner and m.status = 'active'
  ) then
    raise exception 'The new owner must already be an active member'
      using errcode = 'check_violation';
  end if;

  update public.group_members set role = 'admin' where group_id = gid and user_id = caller;
  update public.group_members set role = 'owner' where group_id = gid and user_id = new_owner;
end;
$$;

-- ---------------------------------------------------------------------------
-- #3 — Member counts that do not depend on the caller's membership.
--
-- Returns counts only, never member identities, so running as DEFINER exposes
-- nothing that the group card does not already display.
-- ---------------------------------------------------------------------------
create or replace function public.group_member_counts(gids uuid[])
returns table (group_id uuid, member_count int)
language sql
stable
security definer
set search_path = public
as $$
  select m.group_id, count(*)::int
  from public.group_members m
  where m.group_id = any(gids) and m.status = 'active'
  group by m.group_id;
$$;

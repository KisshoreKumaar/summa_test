-- ============================================================================
-- Phase 2 audit fixes
--
--   2. A declined requester could delete the row recording the rejection and
--      immediately re-request. The delete policy is now scoped by status.
--   3. A `connections`-only profile was unreachable: the insert policy's
--      subquery ran under the caller's RLS, so an invisible addressee failed
--      the check and could never receive a request — meaning they could never
--      gain a connection and become visible.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- #3 — Eligibility to receive a request, independent of whether the requester
-- is allowed to see the profile. Returns a boolean only, so it discloses
-- nothing beyond "this id can be sent a request".
-- ---------------------------------------------------------------------------
create or replace function public.can_receive_request(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target
      and p.is_active
      and p.onboarded_at is not null
  );
$$;

drop policy if exists "connections: request" on public.connections;
create policy "connections: request"
  on public.connections for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and public.can_receive_request(addressee_id)
  );

-- ---------------------------------------------------------------------------
-- #3 (cont.) — A limited preview so a restricted profile is reachable at all.
--
-- Someone holding the profile link sees name, avatar, branch, and year, and
-- can send a request. Bio, skills, interests, links, and email stay private
-- until the profiles RLS policy admits them. Restricted profiles remain
-- excluded from search; this only makes a direct link work.
-- ---------------------------------------------------------------------------
create or replace function public.profile_preview(target uuid)
returns table (
  id         uuid,
  full_name  text,
  avatar_url text,
  branch     text,
  year       smallint,
  visibility public.profile_visibility
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.avatar_url, p.branch, p.year, p.visibility
  from public.profiles p
  where p.id = target
    and p.is_active
    and p.onboarded_at is not null;
$$;

-- ---------------------------------------------------------------------------
-- #2 — Deletion scoped by status, so a rejection cannot be erased by the
-- person it was issued against.
--
--   pending   the requester may cancel; the addressee responds instead of
--             deleting, which keeps the rejection on record
--   accepted  either party may disconnect
--   rejected  only the addressee may clear it, which is what lets them give
--             someone a second chance
-- ---------------------------------------------------------------------------
drop policy if exists "connections: withdraw" on public.connections;
create policy "connections: withdraw"
  on public.connections for delete
  to authenticated
  using (
    (status = 'pending'  and requester_id = (select auth.uid()))
    or (status = 'accepted' and (select auth.uid()) in (requester_id, addressee_id))
    or (status = 'rejected' and addressee_id = (select auth.uid()))
  );

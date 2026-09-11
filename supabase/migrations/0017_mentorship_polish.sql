-- ============================================================================
-- 0017 — Remaining Phase 6 audit fixes
--
--   5. A single mentor was fetched by scanning the directory, so mentor #61
--      404'd on their own page — and no mentor could view their own page at
--      all, since the directory excludes the caller.
--   7. `mentors` was readable with `using (true)`, so a paused mentor's row was
--      still queryable even though the directory filters them out.
--   8. Nothing stopped a mentor publishing a slot in the past.
--   9. Nothing stopped a mentor publishing overlapping slots.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- #5 — One mentor, by id.
--
-- DEFINER for the same reason as search_mentors: being in the directory is the
-- consent to be seen, so a restricted profile still resolves. Unlike the
-- directory this does not exclude the caller, so a mentor can open their own
-- page, and it reports is_active so the UI can show a paused state.
-- ---------------------------------------------------------------------------
create or replace function public.get_mentor_profile(target uuid)
returns table (
  user_id      uuid,
  full_name    text,
  avatar_url   text,
  branch       text,
  year         smallint,
  expertise    text[],
  bio          text,
  is_active    boolean,
  open_slots   int,
  is_connected boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    p.full_name,
    p.avatar_url,
    p.branch,
    p.year,
    m.expertise,
    m.bio,
    m.is_active,
    (
      select count(*)::int from public.mentor_availability a
      where a.mentor_id = m.user_id and not a.is_booked and a.slot_start > now()
    ),
    public.are_connected(m.user_id, (select auth.uid()))
  from public.mentors m
  join public.profiles p on p.id = m.user_id
  where m.user_id = target
    and p.is_active;
$$;

-- ---------------------------------------------------------------------------
-- #7 — A paused mentor is not a listed mentor.
--
-- Still readable by themselves, by anyone they have an accepted mentorship
-- with, and by super admins.
-- ---------------------------------------------------------------------------
drop policy if exists "mentors: read" on public.mentors;
create policy "mentors: read"
  on public.mentors for select
  to authenticated
  using (
    is_active
    or user_id = (select auth.uid())
    or public.has_accepted_mentorship(user_id, (select auth.uid()))
    or (select public.is_super_admin())
  );

-- ---------------------------------------------------------------------------
-- #8 — Slots have to be in the future.
--
-- A CHECK constraint cannot call now(), so this lives in the insert policy.
-- ---------------------------------------------------------------------------
drop policy if exists "availability: offer" on public.mentor_availability;
create policy "availability: offer"
  on public.mentor_availability for insert
  to authenticated
  with check (
    mentor_id = (select auth.uid())
    and not is_booked
    and booked_by is null
    and slot_start > now()
  );

-- ---------------------------------------------------------------------------
-- #9 — No overlapping slots for the same mentor.
--
-- Guarded: btree_gist is available on Supabase, but the constraint would fail
-- to apply on a database that already holds overlapping rows, and that should
-- not stop the rest of the migration.
-- ---------------------------------------------------------------------------
do $$
begin
  create extension if not exists btree_gist;

  if not exists (
    select 1 from pg_constraint where conname = 'availability_no_overlap'
  ) then
    alter table public.mentor_availability
      add constraint availability_no_overlap
      exclude using gist (
        mentor_id with =,
        tstzrange(slot_start, slot_end) with &&
      );
  end if;
exception when others then
  raise notice 'Skipped availability_no_overlap: %', sqlerrm;
end $$;

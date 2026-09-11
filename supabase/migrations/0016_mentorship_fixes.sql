-- ============================================================================
-- 0016 — Phase 6 audit fixes
--
--   1. A mentee could move a request straight from 'requested' to 'completed',
--      closing out a mentorship the mentor had never accepted — and because a
--      completed thread cannot be reopened, the mentor's accept then failed.
--   2. release_mentor_slot() guarded the availability update but not the
--      follow-up that clears the request link, so any signed-in user could
--      strip somebody else's booking off their request.
--   3. Nothing stopped one mentee booking every slot a mentor offered.
--   4. A declined mentee could re-request immediately, with no limit.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- #1 — Legal transitions only.
--
-- RLS splits OLD (using) from NEW (with check) and cannot express the pairing
-- between them, so the state machine lives in a trigger. The policy stays as a
-- coarse gate; this decides what the move actually is.
-- ---------------------------------------------------------------------------
-- The cooling-off window needs its own timestamp. `updated_at` is maintained by
-- a trigger, so any later edit to the row would silently restart the window.
alter table public.mentorship_requests
  add column if not exists declined_at timestamptz;

create or replace function public.guard_mentorship_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  -- Service role and DEFINER callers (e.g. book_mentor_slot) pass through.
  if me is null or new.status = old.status then
    return new;
  end if;

  if old.status = 'requested' and new.status in ('accepted', 'declined') then
    if me <> old.mentor_id then
      raise exception 'Only the mentor can answer a request'
        using errcode = 'insufficient_privilege';
    end if;
    if new.status = 'declined' then
      new.declined_at := now();
    end if;
    return new;
  end if;

  if old.status = 'accepted' and new.status = 'completed' then
    if me <> old.mentor_id and me <> old.mentee_id then
      raise exception 'Not your mentorship' using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  raise exception 'A mentorship cannot move from % to %', old.status, new.status
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists mentorship_guard_transition on public.mentorship_requests;
create trigger mentorship_guard_transition
  before update on public.mentorship_requests
  for each row execute function public.guard_mentorship_transition();

-- The policy no longer needs to describe the state machine, only who may act.
drop policy if exists "mentorship: respond" on public.mentorship_requests;
create policy "mentorship: respond"
  on public.mentorship_requests for update
  to authenticated
  using (
    status in ('requested', 'accepted')
    and (mentor_id = (select auth.uid()) or mentee_id = (select auth.uid()))
  )
  with check (
    mentor_id = (select auth.uid()) or mentee_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- #4 — A decline holds for a month.
--
-- Connections make a rejection permanent. A mentorship decline is usually
-- "not this term" rather than "never", so this is a cooling-off period instead
-- of a permanent block — but it is no longer zero.
-- ---------------------------------------------------------------------------
create or replace function public.can_request_mentorship(
  mentor uuid,
  mentee uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.mentorship_requests r
    where r.mentor_id = mentor
      and r.mentee_id = mentee
      and r.status = 'declined'
      and coalesce(r.declined_at, r.updated_at) > now() - interval '30 days'
  );
$$;

drop policy if exists "mentorship: ask" on public.mentorship_requests;
create policy "mentorship: ask"
  on public.mentorship_requests for insert
  to authenticated
  with check (
    mentee_id = (select auth.uid())
    and status = 'requested'
    and public.is_active_mentor(mentor_id)
    and public.can_request_mentorship(mentor_id)
  );

-- ---------------------------------------------------------------------------
-- #2 and #3 — Booking and releasing
-- ---------------------------------------------------------------------------
create or replace function public.book_mentor_slot(slot uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me      uuid := (select auth.uid());
  mentor  uuid;
  claimed uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  select a.mentor_id into mentor from public.mentor_availability a where a.id = slot;

  if mentor is null then
    raise exception 'That slot no longer exists' using errcode = 'check_violation';
  end if;
  if mentor = me then
    raise exception 'You cannot book your own slot' using errcode = 'check_violation';
  end if;
  if not public.has_accepted_mentorship(mentor, me) then
    raise exception 'The mentor has to accept your request before you can book'
      using errcode = 'insufficient_privilege';
  end if;

  -- #3 — one live booking per mentee per mentor. Without this a single mentee
  -- could take every slot on offer, and each new booking orphaned the previous
  -- one: still held, no longer linked to anything.
  if exists (
    select 1 from public.mentor_availability a
    where a.mentor_id = mentor
      and a.booked_by = me
      and a.slot_end > now()
  ) then
    raise exception 'You already have a session booked with this mentor'
      using errcode = 'unique_violation';
  end if;

  update public.mentor_availability a
     set is_booked = true, booked_by = me
   where a.id = slot and not a.is_booked
  returning a.id into claimed;

  if claimed is null then
    raise exception 'That slot has already been taken' using errcode = 'unique_violation';
  end if;

  update public.mentorship_requests r
     set slot_id = slot
   where r.mentor_id = mentor and r.mentee_id = me and r.status = 'accepted';

  return claimed;
end;
$$;

create or replace function public.release_mentor_slot(slot uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me    uuid := (select auth.uid());
  freed uuid;
begin
  if me is null then
    return;
  end if;

  update public.mentor_availability a
     set is_booked = false, booked_by = null
   where a.id = slot
     and (a.booked_by = me or a.mentor_id = me)
  returning a.id into freed;

  -- #2 — only clear the request link if this caller actually freed the slot.
  -- The follow-up used to run unconditionally, so anyone could strip somebody
  -- else's booking off their mentorship request.
  if freed is null then
    return;
  end if;

  update public.mentorship_requests r
     set slot_id = null
   where r.slot_id = freed;
end;
$$;

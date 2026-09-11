-- ============================================================================
-- Phase 6 — Mentorship RPCs, directory search, and notifications
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Booking.
--
-- A mentee has no UPDATE policy on mentor_availability, so this is the only
-- path. Running as DEFINER also lets the whole check-and-claim happen in one
-- statement, which is what stops two mentees taking the same slot.
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

  -- Conditional update: whoever gets here second updates nothing.
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
  me uuid := (select auth.uid());
begin
  if me is null then
    return;
  end if;

  update public.mentor_availability a
     set is_booked = false, booked_by = null
   where a.id = slot
     and (a.booked_by = me or a.mentor_id = me);

  update public.mentorship_requests r
     set slot_id = null
   where r.slot_id = slot;
end;
$$;

-- ---------------------------------------------------------------------------
-- Directory search.
--
-- DEFINER on purpose. Opting into the mentor directory is consent to be listed,
-- so a mentor whose profile visibility is 'department' or 'connections' still
-- appears — otherwise the directory would silently hide the people most likely
-- to have restricted their profile, the same trap the connections-only profiles
-- fell into in Phase 2. Only directory-appropriate columns are returned.
-- ---------------------------------------------------------------------------
create or replace function public.search_mentors(
  q             text default null,
  expertise_tags text[] default null,
  branches      text[] default null,
  years         int[] default null,
  page_limit    int default 24,
  page_offset   int default 0
)
returns table (
  user_id     uuid,
  full_name   text,
  avatar_url  text,
  branch      text,
  year        smallint,
  expertise   text[],
  bio         text,
  open_slots  int,
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
    (
      select count(*)::int from public.mentor_availability a
      where a.mentor_id = m.user_id and not a.is_booked and a.slot_start > now()
    ),
    public.are_connected(m.user_id, (select auth.uid()))
  from public.mentors m
  join public.profiles p on p.id = m.user_id
  where m.is_active
    and p.is_active
    and m.user_id <> (select auth.uid())
    and (
      q is null or btrim(q) = ''
      or p.full_name ilike '%' || btrim(q) || '%'
      or exists (select 1 from unnest(m.expertise) e where e ilike '%' || btrim(q) || '%')
    )
    and (expertise_tags is null or cardinality(expertise_tags) = 0 or m.expertise && expertise_tags)
    and (branches is null or cardinality(branches) = 0 or p.branch = any(branches))
    and (years is null or cardinality(years) = 0 or p.year::int = any(years))
  order by cardinality(m.expertise) desc, p.full_name asc nulls last, m.user_id asc
  limit greatest(1, least(page_limit, 60))
  offset greatest(0, page_offset);
$$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create or replace function public.notify_mentorship_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, entity_id)
  values (new.mentor_id, new.mentee_id, 'mentorship_request', new.id);
  return new;
end;
$$;

drop trigger if exists mentorship_notify_request on public.mentorship_requests;
create trigger mentorship_notify_request
  after insert on public.mentorship_requests
  for each row
  when (new.status = 'requested')
  execute function public.notify_mentorship_request();

create or replace function public.notify_mentorship_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, entity_id)
  values (new.mentee_id, new.mentor_id, 'mentorship_accepted', new.id);
  return new;
end;
$$;

drop trigger if exists mentorship_notify_accepted on public.mentorship_requests;
create trigger mentorship_notify_accepted
  after update on public.mentorship_requests
  for each row
  when (new.status = 'accepted' and old.status is distinct from 'accepted')
  execute function public.notify_mentorship_accepted();

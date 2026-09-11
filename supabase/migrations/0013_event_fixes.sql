-- ============================================================================
-- 0013 — Phase 5 audit fixes (database half)
--
--   5. Counting RSVPs meant fetching every RSVP row for every event card.
--   8. Upcoming/past was split on start_time, so an event that had begun but
--      was still running counted as past.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- #8 — A single column to sort and filter on, so "has it finished" is one
-- comparison rather than a coalesce the query planner cannot use.
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists ends_at timestamptz
  generated always as (coalesce(end_time, start_time)) stored;

create index if not exists events_ends_at_idx on public.events (ends_at desc);

-- ---------------------------------------------------------------------------
-- #5 — Counts computed in the database and returned as numbers.
--
-- Only the public statuses are counted, which is what makes this safe to run
-- with invoker rights: 'not_going' is hidden by RLS and is excluded anyway.
-- ---------------------------------------------------------------------------
create or replace function public.event_rsvp_counts(event_ids uuid[])
returns table (
  event_id         uuid,
  going_count      int,
  interested_count int
)
language sql
stable
as $$
  select
    r.event_id,
    count(*) filter (where r.status = 'going')::int,
    count(*) filter (where r.status = 'interested')::int
  from public.event_rsvps r
  where r.event_id = any(event_ids)
    and r.status <> 'not_going'
  group by r.event_id;
$$;

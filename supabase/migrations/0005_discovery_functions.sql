-- ============================================================================
-- Phase 2 — Discovery SQL
--
-- Both functions run with INVOKER rights on purpose: profiles RLS then applies
-- automatically, so a search can never surface a profile the viewer is not
-- allowed to see. Only mutual_connection_count() is DEFINER, and it returns a
-- count rather than rows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- search_profiles — free-text over name/skills/interests plus tag filters.
-- ---------------------------------------------------------------------------
create or replace function public.search_profiles(
  q           text default null,
  branches    text[] default null,
  years       int[] default null,
  skill_tags  text[] default null,
  interest_tags text[] default null,
  page_limit  int default 24,
  page_offset int default 0
)
returns setof public.profiles
language sql
stable
as $$
  select p.*
  from public.profiles p
  where p.id <> (select auth.uid())
    and p.onboarded_at is not null
    and (
      q is null or btrim(q) = ''
      or p.full_name ilike '%' || btrim(q) || '%'
      or exists (select 1 from unnest(p.skills)    s where s ilike '%' || btrim(q) || '%')
      or exists (select 1 from unnest(p.interests) i where i ilike '%' || btrim(q) || '%')
    )
    and (branches      is null or cardinality(branches) = 0      or p.branch = any(branches))
    and (years         is null or cardinality(years) = 0         or p.year::int = any(years))
    and (skill_tags    is null or cardinality(skill_tags) = 0    or p.skills    && skill_tags)
    and (interest_tags is null or cardinality(interest_tags) = 0 or p.interests && interest_tags)
  order by p.full_name asc nulls last, p.id asc
  limit greatest(1, least(page_limit, 60))
  offset greatest(0, page_offset);
$$;

-- ---------------------------------------------------------------------------
-- suggested_people — "people you may know".
--
-- Plain SQL scoring, no ML: shared skills and interests plus mutual
-- connections, weighted. Anyone already connected to (or with a pending or
-- rejected request with) the viewer is excluded.
-- ---------------------------------------------------------------------------
create or replace function public.suggested_people(page_limit int default 12)
returns table (
  id                 uuid,
  full_name          text,
  year               smallint,
  branch             text,
  bio                text,
  avatar_url         text,
  skills             text[],
  interests          text[],
  shared_skills      int,
  shared_interests   int,
  mutual_connections int,
  score              int
)
language sql
stable
as $$
  with viewer as (
    select pr.id, pr.skills, pr.interests, pr.branch
    from public.profiles pr
    where pr.id = (select auth.uid())
  ),
  candidates as (
    select
      p.id, p.full_name, p.year, p.branch, p.bio, p.avatar_url, p.skills, p.interests,
      cardinality(array(select unnest(p.skills)    intersect select unnest(v.skills)))    as shared_skills,
      cardinality(array(select unnest(p.interests) intersect select unnest(v.interests))) as shared_interests,
      public.mutual_connection_count(p.id) as mutual_connections,
      (p.branch is not distinct from v.branch) as same_branch
    from public.profiles p, viewer v
    where p.id <> v.id
      and p.onboarded_at is not null
      -- Nothing already in flight or settled between the two of them.
      and not exists (
        select 1 from public.connections c
        where (c.requester_id = v.id and c.addressee_id = p.id)
           or (c.requester_id = p.id and c.addressee_id = v.id)
      )
  )
  select
    c.id, c.full_name, c.year, c.branch, c.bio, c.avatar_url, c.skills, c.interests,
    c.shared_skills, c.shared_interests, c.mutual_connections,
    (c.shared_skills * 3
      + c.shared_interests * 2
      + c.mutual_connections * 4
      + case when c.same_branch then 1 else 0 end) as score
  from candidates c
  where c.shared_skills > 0
     or c.shared_interests > 0
     or c.mutual_connections > 0
     or c.same_branch
  order by score desc, c.full_name asc nulls last, c.id asc
  limit greatest(1, least(page_limit, 50));
$$;

-- ---------------------------------------------------------------------------
-- connection_state — what the viewer's relationship with `target` is, used to
-- pick which button to render.
-- ---------------------------------------------------------------------------
create or replace function public.connection_state(target uuid)
returns table (
  connection_id uuid,
  status        text,
  direction     text
)
language sql
stable
as $$
  select
    c.id,
    c.status::text,
    case when c.requester_id = (select auth.uid()) then 'outgoing' else 'incoming' end
  from public.connections c
  where (select auth.uid()) in (c.requester_id, c.addressee_id)
    and target in (c.requester_id, c.addressee_id)
  limit 1;
$$;

-- ============================================================================
-- 0003 — Remaining Phase 1 audit fixes
--
-- Apply this if you already ran 0001 before these corrections. Fresh installs
-- get the same result from 0001 alone; re-running this file is harmless.
--
--   9.  `year` bounds disagreed: the UI offers 1-5, the DB allowed 1-6.
--   11. RLS policies called auth.uid() / is_admin() per row. Wrapping them in a
--       scalar subquery lets the planner hoist them into an initPlan, so they
--       run once per statement instead of once per row.
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_year_check;
alter table public.profiles
  add constraint profiles_year_check check (year is null or year between 1 and 5);

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles: read visible" on public.profiles;
create policy "profiles: read visible"
  on public.profiles for select
  to authenticated
  using (
    is_active
    and id <> (select auth.uid())
    and (
      visibility = 'public'
      or (visibility = 'department' and public.same_branch(id))
    )
  );

drop policy if exists "profiles: admin read all" on public.profiles;
create policy "profiles: admin read all"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "profiles: admin update" on public.profiles;
create policy "profiles: admin update"
  on public.profiles for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and role = 'student'::public.user_role
    and is_active
  );

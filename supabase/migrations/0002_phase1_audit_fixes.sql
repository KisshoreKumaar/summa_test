-- ============================================================================
-- 0002 — Phase 1 audit fixes
--
-- Apply this if you already ran 0001 before these corrections. Fresh installs
-- get the same result from 0001 alone; re-running this file is harmless.
--
--   1. The privilege guard blocked the auth.users -> profiles email sync,
--      because SECURITY DEFINER does not clear auth.uid(). It now validates the
--      new address against auth.users instead of rejecting every change.
--   2. The self-insert policy did not constrain `role`, so a user could insert
--      themselves as super_admin in any window where their profile row was
--      missing. It now pins role to 'student' and requires is_active.
-- ============================================================================

-- SECURITY DEFINER so the email check can read auth.users. Note that
-- SECURITY DEFINER does *not* clear auth.uid(): it reads the request's JWT
-- claim, so the checks below still apply to the calling user.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;                       -- service role / server-side job
  end if;

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Not allowed to change role' using errcode = 'insufficient_privilege';
  end if;

  if new.is_active is distinct from old.is_active and not public.is_admin() then
    raise exception 'Not allowed to change is_active' using errcode = 'insufficient_privilege';
  end if;

  if new.id is distinct from old.id then
    raise exception 'Not allowed to change id' using errcode = 'insufficient_privilege';
  end if;

  /*
   * profiles.email mirrors auth.users.email. handle_user_email_change() must be
   * able to sync it, but nobody may set it to an arbitrary value. Comparing
   * against auth.users (already updated, since that trigger fires AFTER) lets
   * the sync through and rejects everything else.
   */
  if new.email is distinct from old.email
     and new.email is distinct from (
       select u.email from auth.users u where u.id = new.id
     ) then
    raise exception 'Not allowed to change email' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------------
-- Self-insert policy
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: insert own" on public.profiles;

-- The trigger normally creates this row. The self-insert fallback must not be
-- a privilege-escalation path, so a user may only insert themselves as an
-- ordinary active student; the UPDATE guard below covers changes after that.
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    and role = 'student'::public.user_role
    and is_active
  );

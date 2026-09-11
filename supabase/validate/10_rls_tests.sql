-- ============================================================================
-- Behavioural tests for the Phase 2 RLS policies and triggers.
-- Runs in the throwaway validation Postgres, never against Supabase.
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Supabase grants these to `authenticated` by default; the stub does not.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures. Inserting into auth.users exercises handle_new_user().
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@college-domain.edu', '{"full_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@college-domain.edu',   '{"full_name":"Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@college-domain.edu', '{"full_name":"Carol"}');

update public.profiles set onboarded_at = now(), branch = 'Computer Science', visibility = 'public'
  where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
-- Carol is connections-only.
update public.profiles set onboarded_at = now(), branch = 'Design', visibility = 'connections'
  where id = '33333333-3333-3333-3333-333333333333';

create or replace function pg_temp.report(label text, ok boolean) returns void
language plpgsql as $$
begin
  raise notice '  [%] %', case when ok then 'PASS' else 'FAIL' end, label;
end $$;

create or replace function pg_temp.as_user(uid text) returns void
language plpgsql as $$
begin
  execute format('set role authenticated');
  execute format('set request.jwt.claim.sub = %L', uid);
end $$;

-- ---------------------------------------------------------------------------
do $$
declare ok boolean; n int;
begin
raise notice '';
raise notice 'Profile creation trigger:';
select count(*) = 3 into ok from public.profiles;
perform pg_temp.report('handle_new_user created a profile per auth user', ok);

raise notice '';
raise notice 'Connection request flow:';
end $$;

-- Alice requests Bob
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.connections (requester_id, addressee_id)
values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
reset role;

do $$
declare ok boolean;
begin
  select count(*) = 1 into ok from public.connections where status = 'pending';
  perform pg_temp.report('Alice can send Bob a pending request', ok);

  select count(*) = 1 into ok from public.notifications
   where user_id = '22222222-2222-2222-2222-222222222222' and type = 'connection_request';
  perform pg_temp.report('request fired a connection_request notification', ok);
end $$;

-- Requester must not be able to accept their own request.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
declare n int;
begin
  update public.connections set status = 'accepted'
   where requester_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  perform pg_temp.report('requester cannot self-accept (0 rows affected)', n = 0);
end $$;
reset role;

-- Addressee accepts.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$
declare n int;
begin
  update public.connections set status = 'accepted'
   where addressee_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  perform pg_temp.report('addressee can accept (1 row affected)', n = 1);
end $$;
reset role;

do $$
declare ok boolean;
begin
  select count(*) = 1 into ok from public.notifications
   where user_id = '11111111-1111-1111-1111-111111111111' and type = 'connection_accepted';
  perform pg_temp.report('acceptance fired a connection_accepted notification', ok);

  select public.are_connected(
    '11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222') into ok;
  perform pg_temp.report('are_connected() reports the pair as connected', ok);
end $$;

-- ---------------------------------------------------------------------------
-- Visibility: can a stranger request a connections-only profile?
-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'connections-only visibility:'; end $$;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
declare ok boolean; n int;
begin
  select count(*) = 0 into ok from public.profiles
   where id = '33333333-3333-3333-3333-333333333333';
  perform pg_temp.report('Carol (connections-only) is hidden from Alice', ok);

  begin
    insert into public.connections (requester_id, addressee_id)
    values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333');
    perform pg_temp.report('Alice can request Carol despite not seeing her', true);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('Alice can request Carol despite not seeing her', false);
  end;

  -- The preview is what makes that reachable from the UI.
  select count(*) = 1 into ok from public.profile_preview(
    '33333333-3333-3333-3333-333333333333');
  perform pg_temp.report('profile_preview exposes Carol as a limited card', ok);

  select count(*) = 0 into ok from public.profiles
   where id = '33333333-3333-3333-3333-333333333333' and bio is not null;
  perform pg_temp.report('Carol''s full row is still hidden from Alice', ok);
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Does a rejection stick?
-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'rejection durability:'; end $$;

insert into auth.users (id, email, raw_user_meta_data)
values ('44444444-4444-4444-4444-444444444444','dan@college-domain.edu','{"full_name":"Dan"}');
update public.profiles set onboarded_at = now(), branch = 'Computer Science', visibility = 'public'
 where id = '44444444-4444-4444-4444-444444444444';

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.connections (requester_id, addressee_id)
values ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444');
reset role;

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
update public.connections set status = 'rejected'
 where addressee_id = '44444444-4444-4444-4444-444444444444';
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
declare n int; ok boolean;
begin
  -- The rejected requester tries to erase the record of the rejection.
  delete from public.connections
   where requester_id = '11111111-1111-1111-1111-111111111111'
     and addressee_id = '44444444-4444-4444-4444-444444444444';
  get diagnostics n = row_count;
  perform pg_temp.report('requester cannot delete a rejected row', n = 0);

  -- ...and cannot slip a fresh request past the unique pair index either.
  begin
    insert into public.connections (requester_id, addressee_id)
    values ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444');
    perform pg_temp.report('rejection is durable (re-request blocked)', false);
  exception when unique_violation then
    perform pg_temp.report('rejection is durable (re-request blocked)', true);
  end;
end $$;
reset role;

-- The addressee may still clear a rejection to give someone another chance.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare n int;
begin
  delete from public.connections
   where addressee_id = '44444444-4444-4444-4444-444444444444' and status = 'rejected';
  get diagnostics n = row_count;
  perform pg_temp.report('addressee can clear a rejection they issued', n = 1);
end $$;
reset role;

-- A requester may still cancel their own pending request.
do $$ begin raise notice ''; raise notice 'delete policy still permits:'; end $$;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$
declare n int;
begin
  insert into public.connections (requester_id, addressee_id)
  values ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444');
  delete from public.connections
   where requester_id = '11111111-1111-1111-1111-111111111111'
     and addressee_id = '44444444-4444-4444-4444-444444444444'
     and status = 'pending';
  get diagnostics n = row_count;
  perform pg_temp.report('requester can cancel their own pending request', n = 1);

  -- And either party may walk away from an accepted connection.
  delete from public.connections
   where status = 'accepted'
     and '11111111-1111-1111-1111-111111111111' in (requester_id, addressee_id);
  get diagnostics n = row_count;
  perform pg_temp.report('either party can remove an accepted connection', n = 1);
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Can a third party read someone else's connections?
-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'connection privacy:'; end $$;

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$
declare ok boolean;
begin
  /*
   * Carol is a party to Alice's request, so the assertion is not "sees
   * nothing" but "sees nothing she is not part of" — an invariant that holds
   * regardless of what the fixtures above happen to create.
   */
  select count(*) = 0 into ok from public.connections c
   where '33333333-3333-3333-3333-333333333333' not in (c.requester_id, c.addressee_id);
  perform pg_temp.report('Carol sees no connection she is not a party to', ok);

  select count(*) = 0 into ok from public.connections c
   where c.requester_id = '11111111-1111-1111-1111-111111111111'
     and c.addressee_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.report('the Alice/Bob connection is invisible to Carol', ok);

  select count(*) = 0 into ok from public.notifications n
   where n.user_id <> '33333333-3333-3333-3333-333333333333';
  perform pg_temp.report('Carol sees no notification addressed to someone else', ok);
end $$;
reset role;

-- Can a user forge a notification?
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$
begin
  begin
    insert into public.notifications (user_id, type)
    values ('11111111-1111-1111-1111-111111111111','connection_request');
    perform pg_temp.report('notifications are trigger-only (forgery blocked)', false);
  exception when insufficient_privilege then
    perform pg_temp.report('notifications are trigger-only (forgery blocked)', true);
  end;
end $$;
reset role;

do $$ begin raise notice ''; end $$;

-- ============================================================================
-- Phase 3 audit probes. These assert the DESIRED behaviour, so a FAIL here is
-- a real defect rather than a broken test.
-- ============================================================================
set client_min_messages = notice;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

create or replace function pg_temp.report(label text, ok boolean) returns void
language plpgsql as $$
begin
  raise notice '  [%] %', case when ok then 'PASS' else 'FAIL' end, label;
end $$;

create or replace function pg_temp.as_user(uid text) returns void
language plpgsql as $$
begin
  execute 'set role authenticated';
  execute format('set request.jwt.claim.sub = %L', uid);
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-0000-0000-0000-000000000001','p1@college-domain.edu','{"full_name":"Owner"}'),
  ('dddddddd-0000-0000-0000-000000000002','p2@college-domain.edu','{"full_name":"Admin"}'),
  ('dddddddd-0000-0000-0000-000000000003','p3@college-domain.edu','{"full_name":"Outsider"}');

update public.profiles set onboarded_at = now(), branch = 'Chemical Engineering', year = 4
 where id::text like 'dddddddd%';

-- Owner creates a public group; a second user joins and is promoted to admin.
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000001');
insert into public.groups (id, name, type, category, created_by)
values ('eeeeeeee-0000-0000-0000-00000000000a','Audit Club','public','club',
        'dddddddd-0000-0000-0000-000000000001');
reset role;

select pg_temp.as_user('dddddddd-0000-0000-0000-000000000002');
insert into public.group_members (group_id, user_id, role, status)
values ('eeeeeeee-0000-0000-0000-00000000000a','dddddddd-0000-0000-0000-000000000002','member','active');
reset role;

select pg_temp.as_user('dddddddd-0000-0000-0000-000000000001');
update public.group_members set role = 'admin'
 where group_id = 'eeeeeeee-0000-0000-0000-00000000000a'
   and user_id = 'dddddddd-0000-0000-0000-000000000002';
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Member counts as seen by a non-member:'; end $$;

select pg_temp.as_user('dddddddd-0000-0000-0000-000000000003');
do $$
declare visible int; truth int;
begin
  -- This is exactly the query lib/queries/groups.ts decorate() runs.
  select count(*) into visible from public.group_members
   where group_id = 'eeeeeeee-0000-0000-0000-00000000000a' and status = 'active';

  select public.group_member_count('eeeeeeee-0000-0000-0000-00000000000a') into truth;

  raise notice '        raw rows visible to an outsider: % (restricted by design), counter says: %',
        visible, truth;
  -- The app must not count rows directly; it must ask the counter.
  perform pg_temp.report('group_member_count() gives an outsider the true count', truth = 2);
  perform pg_temp.report('group_member_counts() batches the same truth',
    (select mc.member_count from public.group_member_counts(
       array['eeeeeeee-0000-0000-0000-00000000000a'::uuid]) mc) = 2);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Group role escalation:'; end $$;

select pg_temp.as_user('dddddddd-0000-0000-0000-000000000002');
do $$
declare n int;
begin
  begin
    update public.group_members set role = 'owner'
     where group_id = 'eeeeeeee-0000-0000-0000-00000000000a'
       and user_id = 'dddddddd-0000-0000-0000-000000000002';
    get diagnostics n = row_count;
    perform pg_temp.report('a group admin cannot promote themselves to owner', n = 0);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('a group admin cannot promote themselves to owner', true);
  end;
end $$;

do $$
declare n int;
begin
  begin
    update public.group_members set role = 'member'
     where group_id = 'eeeeeeee-0000-0000-0000-00000000000a'
       and user_id = 'dddddddd-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    perform pg_temp.report('a group admin cannot demote the owner', n = 0);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('a group admin cannot demote the owner', true);
  end;
end $$;

do $$
declare n int;
begin
  begin
    delete from public.group_members
     where group_id = 'eeeeeeee-0000-0000-0000-00000000000a'
       and user_id = 'dddddddd-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    perform pg_temp.report('a group admin cannot remove the owner', n = 0);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('a group admin cannot remove the owner', true);
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Owner abandonment:'; end $$;

-- Fresh group: the probe above may already have removed the first owner, so
-- reusing that group would give a meaningless result.
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000003');
insert into public.groups (id, name, type, category, created_by)
values ('eeeeeeee-0000-0000-0000-00000000000b','Solo Group','public','club',
        'dddddddd-0000-0000-0000-000000000003');

do $$
declare n int;
begin
  begin
    delete from public.group_members
     where group_id = 'eeeeeeee-0000-0000-0000-00000000000b'
       and user_id = 'dddddddd-0000-0000-0000-000000000003';
    get diagnostics n = row_count;
    perform pg_temp.report('an owner cannot abandon their group via a direct delete', n = 0);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('an owner cannot abandon their group via a direct delete', true);
  end;
end $$;
reset role;

do $$
declare owners int;
begin
  select count(*) into owners from public.group_members
   where group_id = 'eeeeeeee-0000-0000-0000-00000000000b' and role = 'owner';
  perform pg_temp.report('a group is never left without an owner', owners = 1);
end $$;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Ownership transfer:'; end $$;

-- Outsider owns 'Solo Group'. Add a second member to hand it to.
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000002');
insert into public.group_members (group_id, user_id, role, status)
values ('eeeeeeee-0000-0000-0000-00000000000b','dddddddd-0000-0000-0000-000000000002','member','active');
reset role;

-- A non-owner must not be able to transfer.
select pg_temp.as_user('dddddddd-0000-0000-0000-000000000002');
do $$
begin
  begin
    perform public.transfer_group_ownership(
      'eeeeeeee-0000-0000-0000-00000000000b','dddddddd-0000-0000-0000-000000000002');
    perform pg_temp.report('a non-owner cannot transfer ownership', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a non-owner cannot transfer ownership', true);
  end;
end $$;
reset role;

select pg_temp.as_user('dddddddd-0000-0000-0000-000000000003');
do $$
declare ok boolean;
begin
  perform public.transfer_group_ownership(
    'eeeeeeee-0000-0000-0000-00000000000b','dddddddd-0000-0000-0000-000000000002');

  select role = 'owner' into ok from public.group_members
   where group_id = 'eeeeeeee-0000-0000-0000-00000000000b'
     and user_id = 'dddddddd-0000-0000-0000-000000000002';
  perform pg_temp.report('the owner can hand the group over', coalesce(ok,false));

  select role = 'admin' into ok from public.group_members
   where group_id = 'eeeeeeee-0000-0000-0000-00000000000b'
     and user_id = 'dddddddd-0000-0000-0000-000000000003';
  perform pg_temp.report('the previous owner becomes an admin', coalesce(ok,false));
end $$;

-- Having handed over, the former owner can now leave.
do $$
declare n int;
begin
  delete from public.group_members
   where group_id = 'eeeeeeee-0000-0000-0000-00000000000b'
     and user_id = 'dddddddd-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  perform pg_temp.report('a former owner can leave once they have handed over', n = 1);
end $$;
reset role;

do $$
declare owners int;
begin
  select count(*) into owners from public.group_members
   where group_id = 'eeeeeeee-0000-0000-0000-00000000000b' and role = 'owner';
  perform pg_temp.report('the group still has exactly one owner', owners = 1);
end $$;

do $$ begin raise notice ''; end $$;

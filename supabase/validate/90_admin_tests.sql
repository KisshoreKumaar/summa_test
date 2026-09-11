-- ============================================================================
-- Behavioural tests for Phase 7 admin / moderation.
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
  ('ad000000-0000-0000-0000-000000000001','sa@college-domain.edu','{"full_name":"SuperA"}'),
  ('ad000000-0000-0000-0000-000000000002','ca@college-domain.edu','{"full_name":"ClubA"}'),
  ('ad000000-0000-0000-0000-000000000003','st@college-domain.edu','{"full_name":"Student"}'),
  ('ad000000-0000-0000-0000-000000000004','tr@college-domain.edu','{"full_name":"Troll"}');

update public.profiles set onboarded_at=now(), branch='Physics', year=2
 where id::text like 'ad000000%';
update public.profiles set role='super_admin' where id='ad000000-0000-0000-0000-000000000001';
update public.profiles set role='club_admin'  where id='ad000000-0000-0000-0000-000000000002';

do $$ begin raise notice ''; raise notice 'Role escalation:'; end $$;

select pg_temp.as_user('ad000000-0000-0000-0000-000000000002');
do $$
declare n int;
begin
  begin
    update public.profiles set role='super_admin'
     where id='ad000000-0000-0000-0000-000000000002';
    get diagnostics n = row_count;
    perform pg_temp.report('a club admin cannot promote themselves', n = 0);
  exception when insufficient_privilege then
    perform pg_temp.report('a club admin cannot promote themselves', true);
  end;

  begin
    update public.profiles set is_active=false
     where id='ad000000-0000-0000-0000-000000000003';
    get diagnostics n = row_count;
    perform pg_temp.report('a club admin cannot deactivate a user', n = 0);
  exception when insufficient_privilege then
    perform pg_temp.report('a club admin cannot deactivate a user', true);
  end;

  begin
    perform public.admin_set_user_role('ad000000-0000-0000-0000-000000000002','super_admin');
    perform pg_temp.report('a club admin cannot use the role RPC', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a club admin cannot use the role RPC', true);
  end;

  begin
    perform public.admin_user_list();
    perform pg_temp.report('a club admin cannot list users', 
      (select count(*) from public.admin_user_list()) = 0);
  exception when insufficient_privilege then
    perform pg_temp.report('a club admin cannot list users', true);
  end;
end $$;
reset role;

select pg_temp.as_user('ad000000-0000-0000-0000-000000000003');
do $$
begin
  begin
    perform public.admin_set_user_active('ad000000-0000-0000-0000-000000000004', false);
    perform pg_temp.report('a student cannot ban anybody', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a student cannot ban anybody', true);
  end;

  perform pg_temp.report('a student sees an empty admin queue',
    (select count(*) from public.admin_report_queue()) = 0);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Super admin powers:'; end $$;

select pg_temp.as_user('ad000000-0000-0000-0000-000000000001');
do $$
declare n int; active boolean;
begin
  select count(*) into n from public.admin_user_list();
  perform pg_temp.report('a super admin can list users', n >= 4);

  select count(*) into n from public.admin_user_list('Troll');
  perform pg_temp.report('the user list can be searched', n = 1);

  perform public.admin_set_user_active('ad000000-0000-0000-0000-000000000004', false);
  select is_active into active from public.profiles
   where id = 'ad000000-0000-0000-0000-000000000004';
  perform pg_temp.report('a super admin can deactivate a user', active = false);

  perform public.admin_set_user_active('ad000000-0000-0000-0000-000000000004', true);

  begin
    perform public.admin_set_user_active('ad000000-0000-0000-0000-000000000001', false);
    perform pg_temp.report('a super admin cannot deactivate themselves', false);
  exception when check_violation then
    perform pg_temp.report('a super admin cannot deactivate themselves', true);
  end;

  /*
   * Earlier test files leave their own super admins behind in this database,
   * so make the precondition true before asserting on it: demote everyone else
   * first, then try to step down as the genuinely last one.
   */
  for n in
    select 1 from public.profiles
     where role = 'super_admin' and id <> 'ad000000-0000-0000-0000-000000000001'
  loop
    null;
  end loop;

  update public.profiles set role = 'student'
   where role = 'super_admin' and id <> 'ad000000-0000-0000-0000-000000000001';

  begin
    perform public.admin_set_user_role('ad000000-0000-0000-0000-000000000001','student');
    perform pg_temp.report('the last super admin cannot step down', false);
  exception when check_violation then
    perform pg_temp.report('the last super admin cannot step down', true);
  end;

  perform public.admin_set_user_role('ad000000-0000-0000-0000-000000000002','club_admin');
  perform pg_temp.report('a super admin can set roles', true);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Reporting:'; end $$;

-- The troll posts in a group; a student reports it.
select pg_temp.as_user('ad000000-0000-0000-0000-000000000004');
insert into public.groups (id, name, type, category, created_by)
values ('ad111111-0000-0000-0000-00000000000a','Open Group','public','club',
        'ad000000-0000-0000-0000-000000000004');
insert into public.group_posts (id, group_id, author_id, content)
values ('ad222222-0000-0000-0000-00000000000a','ad111111-0000-0000-0000-00000000000a',
        'ad000000-0000-0000-0000-000000000004','something abusive');
reset role;

select pg_temp.as_user('ad000000-0000-0000-0000-000000000003');
insert into public.group_members (group_id, user_id, role, status)
values ('ad111111-0000-0000-0000-00000000000a','ad000000-0000-0000-0000-000000000003','member','active');

insert into public.reports (reporter_id, target_type, target_id, reason)
values ('ad000000-0000-0000-0000-000000000003','post','ad222222-0000-0000-0000-00000000000a',
        'Abusive language');

do $$
begin
  begin
    insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('ad000000-0000-0000-0000-000000000003','post','ad222222-0000-0000-0000-00000000000a',
            'Again');
    perform pg_temp.report('the same person cannot file a duplicate open report', false);
  exception when unique_violation then
    perform pg_temp.report('the same person cannot file a duplicate open report', true);
  end;

  begin
    insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('ad000000-0000-0000-0000-000000000001','user','ad000000-0000-0000-0000-000000000004',
            'Forged reporter');
    perform pg_temp.report('nobody can file a report as somebody else', false);
  exception when insufficient_privilege then
    perform pg_temp.report('nobody can file a report as somebody else', true);
  end;
end $$;
reset role;

-- The troll must not be able to see reports about them.
select pg_temp.as_user('ad000000-0000-0000-0000-000000000004');
do $$
declare n int;
begin
  select count(*) into n from public.reports;
  perform pg_temp.report('a reported user cannot see the report', n = 0);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Moderating:'; end $$;

-- A club admin who is not in that group can still moderate the queue.
select pg_temp.as_user('ad000000-0000-0000-0000-000000000002');
do $$
declare n int; preview text;
begin
  select count(*) into n from public.admin_report_queue();
  perform pg_temp.report('a moderator sees the open queue', n = 1);

  select q.target_preview into preview from public.admin_report_queue() q limit 1;
  perform pg_temp.report('the queue shows content the moderator cannot otherwise read',
    preview = 'something abusive');

  perform public.admin_resolve_report(
    (select id from public.reports limit 1), 'remove', 'Removed for abuse');

  select count(*) into n from public.group_posts
   where id = 'ad222222-0000-0000-0000-00000000000a';
  perform pg_temp.report('resolving with remove deletes the content', n = 0);

  select count(*) into n from public.admin_report_queue('resolved');
  perform pg_temp.report('the report moves to resolved', n = 1);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Group approval queue:'; end $$;

select pg_temp.as_user('ad000000-0000-0000-0000-000000000004');
insert into public.groups (id, name, type, category, created_by)
values ('ad111111-0000-0000-0000-00000000000b','Closed Group','private','project',
        'ad000000-0000-0000-0000-000000000004');
reset role;

select pg_temp.as_user('ad000000-0000-0000-0000-000000000003');
insert into public.group_members (group_id, user_id, role, status)
values ('ad111111-0000-0000-0000-00000000000b','ad000000-0000-0000-0000-000000000003','member','pending');
reset role;

select pg_temp.as_user('ad000000-0000-0000-0000-000000000002');
do $$
declare n int;
begin
  select count(*) into n from public.admin_pending_group_requests();
  perform pg_temp.report('a club admin sees no queue for groups they do not run', n = 0);
end $$;
reset role;

select pg_temp.as_user('ad000000-0000-0000-0000-000000000004');
do $$
declare n int;
begin
  select count(*) into n from public.admin_pending_group_requests();
  perform pg_temp.report('the group owner sees their own pending request', n = 1);
end $$;
reset role;

select pg_temp.as_user('ad000000-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  select count(*) into n from public.admin_pending_group_requests();
  perform pg_temp.report('a super admin sees every pending request', n >= 1);
end $$;
reset role;

do $$ begin raise notice ''; end $$;

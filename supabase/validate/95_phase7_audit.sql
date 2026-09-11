-- ============================================================================
-- Phase 7 audit probes. These assert DESIRED behaviour: a FAIL is a defect.
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
  ('7a000000-0000-0000-0000-000000000001','p7a@college-domain.edu','{"full_name":"ClubAdminX"}'),
  ('7a000000-0000-0000-0000-000000000002','p7b@college-domain.edu','{"full_name":"GroupOwnerY"}'),
  ('7a000000-0000-0000-0000-000000000003','p7c@college-domain.edu','{"full_name":"PlainZ"}'),
  ('7a000000-0000-0000-0000-000000000004','p7d@college-domain.edu','{"full_name":"PrivatePal"}');

update public.profiles set onboarded_at=now(), branch='Design', year=3
 where id::text like '7a000000%';
update public.profiles set role='club_admin' where id='7a000000-0000-0000-0000-000000000001';

-- A group the club admin has nothing to do with.
select pg_temp.as_user('7a000000-0000-0000-0000-000000000002');
insert into public.groups (id, name, type, category, created_by)
values ('7b000000-0000-0000-0000-00000000000a','Not Their Group','public','club',
        '7a000000-0000-0000-0000-000000000002');
reset role;

do $$ begin raise notice ''; raise notice 'Club admin reach over groups:'; end $$;

select pg_temp.as_user('7a000000-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  begin
    insert into public.group_members (group_id, user_id, role, status)
    values ('7b000000-0000-0000-0000-00000000000a','7a000000-0000-0000-0000-000000000001',
            'member','active');
    update public.group_members set role = 'owner'
     where group_id = '7b000000-0000-0000-0000-00000000000a'
       and user_id = '7a000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    perform pg_temp.report('a club admin cannot make themselves owner of any group', n = 0);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('a club admin cannot make themselves owner of any group', true);
  end;
end $$;

do $$
declare n int;
begin
  begin
    update public.group_members set role = 'member'
     where group_id = '7b000000-0000-0000-0000-00000000000a'
       and user_id = '7a000000-0000-0000-0000-000000000002';
    get diagnostics n = row_count;
    perform pg_temp.report('a club admin cannot demote another group''s owner', n = 0);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('a club admin cannot demote another group''s owner', true);
  end;
end $$;

do $$
declare n int;
begin
  update public.groups set name = 'Renamed By Outsider'
   where id = '7b000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.report('a club admin cannot rename a group they do not run', n = 0);
end $$;

do $$
declare n int;
begin
  delete from public.groups where id = '7b000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.report('a club admin cannot delete a group they do not run', n = 0);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Report target validation:'; end $$;

-- Two people exchange a private DM the reporter is not part of.
select pg_temp.as_user('7a000000-0000-0000-0000-000000000002');
insert into public.connections (requester_id, addressee_id)
values ('7a000000-0000-0000-0000-000000000002','7a000000-0000-0000-0000-000000000004');
reset role;

select pg_temp.as_user('7a000000-0000-0000-0000-000000000004');
update public.connections set status='accepted'
 where addressee_id='7a000000-0000-0000-0000-000000000004'
   and requester_id='7a000000-0000-0000-0000-000000000002';
reset role;

select pg_temp.as_user('7a000000-0000-0000-0000-000000000002');
do $$
declare cid uuid;
begin
  cid := public.get_or_create_dm('7a000000-0000-0000-0000-000000000004');
  insert into public.messages (id, conversation_id, sender_id, content)
  values ('7c000000-0000-0000-0000-00000000000a', cid,
          '7a000000-0000-0000-0000-000000000002', 'a private secret');
end $$;
reset role;

-- A stranger who guessed the id files a report on it.
select pg_temp.as_user('7a000000-0000-0000-0000-000000000003');
do $$
declare n int;
begin
  select count(*) into n from public.messages
   where id = '7c000000-0000-0000-0000-00000000000a';
  perform pg_temp.report('a stranger cannot read that private message', n = 0);

  begin
    insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('7a000000-0000-0000-0000-000000000003','message',
            '7c000000-0000-0000-0000-00000000000a','Made up complaint');
    perform pg_temp.report('a stranger cannot report content they cannot see', false);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('a stranger cannot report content they cannot see', true);
  end;

  begin
    insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('7a000000-0000-0000-0000-000000000003','post',
            '00000000-0000-0000-0000-0000000000ff','Nonexistent target');
    perform pg_temp.report('a report must point at something that exists', false);
  exception when insufficient_privilege or check_violation or foreign_key_violation then
    perform pg_temp.report('a report must point at something that exists', true);
  end;
end $$;
reset role;

-- Did the fabricated report expose the private message to moderators?
select pg_temp.as_user('7a000000-0000-0000-0000-000000000001');
do $$
declare leaked text;
begin
  select q.target_preview into leaked
  from public.admin_report_queue() q
  where q.target_id = '7c000000-0000-0000-0000-00000000000a'
  limit 1;

  perform pg_temp.report('a fabricated report does not surface private content',
    leaked is null);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Direct messages:'; end $$;

select pg_temp.as_user('7a000000-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  select count(*) into n from public.messages
   where id = '7c000000-0000-0000-0000-00000000000a';
  perform pg_temp.report('a club admin cannot read a DM they are not part of', n = 0);

  select count(*) into n from public.conversations;
  perform pg_temp.report('a club admin cannot enumerate conversations', n = 0);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Legitimate powers still work:'; end $$;

-- The group owner can still run their own group.
select pg_temp.as_user('7a000000-0000-0000-0000-000000000002');
do $$
declare n int;
begin
  update public.groups set description = 'Owner edit'
   where id = '7b000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.report('a group owner can still edit their own group', n = 1);
end $$;
reset role;

-- A participant can still report a message in their own conversation.
select pg_temp.as_user('7a000000-0000-0000-0000-000000000004');
do $$
begin
  begin
    insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('7a000000-0000-0000-0000-000000000004','message',
            '7c000000-0000-0000-0000-00000000000a','Genuinely offensive');
    perform pg_temp.report('a participant can still report a message they can see', true);
  exception when others then
    perform pg_temp.report('a participant can still report a message they can see', false);
  end;
end $$;
reset role;

-- And a moderator still sees that legitimate report in full.
select pg_temp.as_user('7a000000-0000-0000-0000-000000000001');
do $$
declare preview text;
begin
  select q.target_preview into preview from public.admin_report_queue() q
   where q.target_id = '7c000000-0000-0000-0000-00000000000a' limit 1;
  perform pg_temp.report('a moderator still sees legitimately reported content',
    preview = 'a private secret');
end $$;
reset role;

-- A super admin retains full reach.
select pg_temp.as_user('ad000000-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  update public.profiles set role = 'super_admin'
   where id = 'ad000000-0000-0000-0000-000000000001';
  select count(*) into n from public.messages
   where id = '7c000000-0000-0000-0000-00000000000a';
  perform pg_temp.report('a super admin can still read any message for moderation', n = 1);
end $$;
reset role;

do $$ begin raise notice ''; end $$;

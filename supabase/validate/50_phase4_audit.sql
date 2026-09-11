-- ============================================================================
-- Phase 4 audit probes. These assert DESIRED behaviour: a FAIL is a defect.
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
  ('a1b2c3d4-0000-0000-0000-000000000001','x1@college-domain.edu','{"full_name":"GroupOwner"}'),
  ('a1b2c3d4-0000-0000-0000-000000000002','x2@college-domain.edu','{"full_name":"Rowdy"}'),
  ('a1b2c3d4-0000-0000-0000-000000000003','x3@college-domain.edu','{"full_name":"Quiet"}');

update public.profiles set onboarded_at = now(), branch = 'Civil Engineering', year = 2, visibility='public'
 where id::text like 'a1b2c3d4%';

do $$ begin raise notice ''; raise notice 'Group chat moderation:'; end $$;

select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000001');
insert into public.groups (id, name, type, category, created_by)
values ('b1b2c3d4-0000-0000-0000-00000000000a','Moderated','public','club',
        'a1b2c3d4-0000-0000-0000-000000000001');
select public.get_or_create_group_conversation('b1b2c3d4-0000-0000-0000-00000000000a');
reset role;

-- A member posts something the owner wants gone.
select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000002');
insert into public.group_members (group_id, user_id, role, status)
values ('b1b2c3d4-0000-0000-0000-00000000000a','a1b2c3d4-0000-0000-0000-000000000002','member','active');

do $$
declare cid uuid;
begin
  select c.id into cid from public.conversations c
   where c.group_id = 'b1b2c3d4-0000-0000-0000-00000000000a';
  insert into public.messages (conversation_id, sender_id, content)
  values (cid, 'a1b2c3d4-0000-0000-0000-000000000002', 'something abusive');
end $$;
reset role;

select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  delete from public.messages m
   using public.conversations c
   where m.conversation_id = c.id
     and c.group_id = 'b1b2c3d4-0000-0000-0000-00000000000a'
     and m.sender_id = 'a1b2c3d4-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.report('a group owner can moderate a message in their group chat', n = 1);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Opening a DM without sending:'; end $$;

-- Connect two people, then open a DM and send nothing at all.
select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000002');
insert into public.connections (requester_id, addressee_id)
values ('a1b2c3d4-0000-0000-0000-000000000002','a1b2c3d4-0000-0000-0000-000000000003');
reset role;

select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000003');
update public.connections set status = 'accepted'
 where addressee_id = 'a1b2c3d4-0000-0000-0000-000000000003'
   and requester_id = 'a1b2c3d4-0000-0000-0000-000000000002';
reset role;

select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000002');
select public.get_or_create_dm('a1b2c3d4-0000-0000-0000-000000000003');
reset role;

select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000003');
do $$
declare empties int;
begin
  select count(*) into empties
  from public.list_conversations() lc
  where lc.type = 'dm' and lc.last_message is null;

  raise notice '        empty DM threads showing in the recipient''s list: %', empties;
  perform pg_temp.report(
    'an unused DM does not appear in the other person''s list', empties = 0);
end $$;
reset role;

-- The moderation grant must not become a general licence to delete.
do $$ begin raise notice ''; raise notice 'Moderation limits:'; end $$;

select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000002');
do $$
declare cid uuid; n int;
begin
  select c.id into cid from public.conversations c
   where c.group_id = 'b1b2c3d4-0000-0000-0000-00000000000a';

  insert into public.messages (conversation_id, sender_id, content)
  values (cid, 'a1b2c3d4-0000-0000-0000-000000000002', 'ordinary message');

  -- An owner message this plain member must not be able to touch.
  insert into public.messages (conversation_id, sender_id, content)
  values (cid, 'a1b2c3d4-0000-0000-0000-000000000002', 'mine to delete');
end $$;
reset role;

select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000001');
insert into public.messages (conversation_id, sender_id, content)
select c.id, 'a1b2c3d4-0000-0000-0000-000000000001', 'owner speaking'
from public.conversations c where c.group_id = 'b1b2c3d4-0000-0000-0000-00000000000a';
reset role;

select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000002');
do $$
declare n int;
begin
  delete from public.messages m
   where m.sender_id = 'a1b2c3d4-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.report('a plain member still cannot delete the owner''s message', n = 0);

  delete from public.messages m
   where m.sender_id = 'a1b2c3d4-0000-0000-0000-000000000002'
     and m.content = 'mine to delete';
  get diagnostics n = row_count;
  perform pg_temp.report('a sender can still retract their own message', n = 1);
end $$;
reset role;

-- Moderation is scoped to the admin's own group, not to chats generally.
do $$ begin raise notice ''; raise notice 'DM visibility for the opener:'; end $$;

select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000002');
do $$
declare mine int;
begin
  select count(*) into mine from public.list_conversations() lc
   where lc.type = 'dm' and lc.last_message is null;
  perform pg_temp.report('the person who opened an empty DM still sees it', mine = 1);
end $$;
reset role;

-- Once a message is sent, both sides see the thread.
select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000002');
do $$
declare cid uuid;
begin
  select c.id into cid from public.conversations c where c.type = 'dm'
     and c.created_by = 'a1b2c3d4-0000-0000-0000-000000000002' limit 1;
  insert into public.messages (conversation_id, sender_id, content)
  values (cid, 'a1b2c3d4-0000-0000-0000-000000000002', 'hello at last');
end $$;
reset role;

select pg_temp.as_user('a1b2c3d4-0000-0000-0000-000000000003');
do $$
declare seen int;
begin
  select count(*) into seen from public.list_conversations() lc where lc.type = 'dm';
  perform pg_temp.report('sending the first message reveals the thread to the recipient', seen = 1);
end $$;
reset role;

do $$ begin raise notice ''; end $$;

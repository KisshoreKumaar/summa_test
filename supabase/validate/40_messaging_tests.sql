-- ============================================================================
-- Behavioural tests for Phase 4 messaging.
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
  ('ffffffff-0000-0000-0000-000000000001','m1@college-domain.edu','{"full_name":"Mira"}'),
  ('ffffffff-0000-0000-0000-000000000002','m2@college-domain.edu','{"full_name":"Nate"}'),
  ('ffffffff-0000-0000-0000-000000000003','m3@college-domain.edu','{"full_name":"Omar"}');

update public.profiles set onboarded_at = now(), branch = 'Biotechnology', year = 3, visibility = 'public'
 where id::text like 'ffffffff%';

do $$ begin raise notice ''; raise notice 'DM eligibility:'; end $$;

-- Mira and Nate are strangers at this point.
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000001');
do $$
begin
  begin
    perform public.get_or_create_dm('ffffffff-0000-0000-0000-000000000002');
    perform pg_temp.report('cannot open a DM with a non-connection', false);
  exception when insufficient_privilege then
    perform pg_temp.report('cannot open a DM with a non-connection', true);
  end;

  begin
    perform public.get_or_create_dm('ffffffff-0000-0000-0000-000000000001');
    perform pg_temp.report('cannot open a DM with yourself', false);
  exception when check_violation then
    perform pg_temp.report('cannot open a DM with yourself', true);
  end;
end $$;

-- Connect them.
insert into public.connections (requester_id, addressee_id)
values ('ffffffff-0000-0000-0000-000000000001','ffffffff-0000-0000-0000-000000000002');
reset role;

select pg_temp.as_user('ffffffff-0000-0000-0000-000000000002');
update public.connections set status = 'accepted'
 where addressee_id = 'ffffffff-0000-0000-0000-000000000002'
   and requester_id = 'ffffffff-0000-0000-0000-000000000001';
reset role;

select pg_temp.as_user('ffffffff-0000-0000-0000-000000000001');
do $$
declare cid uuid; again uuid;
begin
  cid := public.get_or_create_dm('ffffffff-0000-0000-0000-000000000002');
  perform pg_temp.report('connected users can open a DM', cid is not null);

  again := public.get_or_create_dm('ffffffff-0000-0000-0000-000000000002');
  perform pg_temp.report('opening the same DM twice reuses one conversation', again = cid);

  insert into public.messages (conversation_id, sender_id, content)
  values (cid, 'ffffffff-0000-0000-0000-000000000001', 'Hello Nate');
  perform pg_temp.report('a participant can send', true);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'DM privacy:'; end $$;

select pg_temp.as_user('ffffffff-0000-0000-0000-000000000003');
do $$
declare ok boolean; cid uuid;
begin
  select count(*) = 0 into ok from public.messages;
  perform pg_temp.report('an outsider cannot read someone else''s DM', ok);

  select count(*) = 0 into ok from public.conversations;
  perform pg_temp.report('an outsider cannot see the conversation exists', ok);

  select c.id into cid from public.conversations c limit 1;
  perform pg_temp.report('an outsider''s conversation list is empty',
    (select count(*) from public.list_conversations()) = 0);
end $$;
reset role;

-- An outsider must not be able to inject a message into a thread.
do $$
declare cid uuid;
begin
  select c.id into cid from public.conversations c where c.type = 'dm' limit 1;
  perform set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-000000000003', false);
  execute 'set role authenticated';
  begin
    insert into public.messages (conversation_id, sender_id, content)
    values (cid, 'ffffffff-0000-0000-0000-000000000003', 'Butting in');
    perform pg_temp.report('an outsider cannot post into a DM', false);
  exception when insufficient_privilege then
    perform pg_temp.report('an outsider cannot post into a DM', true);
  end;
  reset role;
end $$;

-- Nor forge a message as somebody else.
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000002');
do $$
declare cid uuid;
begin
  select c.id into cid from public.conversations c where c.type = 'dm' limit 1;
  begin
    insert into public.messages (conversation_id, sender_id, content)
    values (cid, 'ffffffff-0000-0000-0000-000000000001', 'Forged');
    perform pg_temp.report('a participant cannot forge another sender', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a participant cannot forge another sender', true);
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Read state:'; end $$;

select pg_temp.as_user('ffffffff-0000-0000-0000-000000000002');
do $$
declare unread int; cid uuid;
begin
  select lc.conversation_id, lc.unread_count into cid, unread
  from public.list_conversations() lc limit 1;
  perform pg_temp.report('the recipient sees the message as unread', unread = 1);

  perform public.mark_conversation_read(cid);

  select lc.unread_count into unread from public.list_conversations() lc
   where lc.conversation_id = cid;
  perform pg_temp.report('marking read clears the unread count', unread = 0);
end $$;

do $$
declare content_now text;
begin
  -- There is no UPDATE policy on messages, so content cannot be rewritten.
  begin
    update public.messages set content = 'tampered' where sender_id <> (select auth.uid());
    select m.content into content_now from public.messages m limit 1;
    perform pg_temp.report('message content cannot be rewritten', content_now <> 'tampered');
  exception when insufficient_privilege then
    perform pg_temp.report('message content cannot be rewritten', true);
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Disconnecting:'; end $$;

select pg_temp.as_user('ffffffff-0000-0000-0000-000000000002');
delete from public.connections
 where addressee_id = 'ffffffff-0000-0000-0000-000000000002'
   and requester_id = 'ffffffff-0000-0000-0000-000000000001';

do $$
declare cid uuid; ok boolean;
begin
  select c.id into cid from public.conversations c where c.type = 'dm' limit 1;

  select count(*) > 0 into ok from public.messages where conversation_id = cid;
  perform pg_temp.report('history stays readable after disconnecting', ok);

  begin
    insert into public.messages (conversation_id, sender_id, content)
    values (cid, 'ffffffff-0000-0000-0000-000000000002', 'Still there?');
    perform pg_temp.report('sending stops once the connection is gone', false);
  exception when insufficient_privilege then
    perform pg_temp.report('sending stops once the connection is gone', true);
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Group chat:'; end $$;

select pg_temp.as_user('ffffffff-0000-0000-0000-000000000001');
insert into public.groups (id, name, type, category, created_by)
values ('99999999-0000-0000-0000-00000000000a','Chat Club','public','club',
        'ffffffff-0000-0000-0000-000000000001');

do $$
declare cid uuid;
begin
  cid := public.get_or_create_group_conversation('99999999-0000-0000-0000-00000000000a');
  perform pg_temp.report('a group member can open the group chat', cid is not null);

  insert into public.messages (conversation_id, sender_id, content)
  values (cid, 'ffffffff-0000-0000-0000-000000000001', 'Welcome everyone');
  perform pg_temp.report('a group member can post to the group chat', true);
end $$;
reset role;

select pg_temp.as_user('ffffffff-0000-0000-0000-000000000003');
do $$
declare ok boolean;
begin
  begin
    perform public.get_or_create_group_conversation('99999999-0000-0000-0000-00000000000a');
    perform pg_temp.report('a non-member cannot open the group chat', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a non-member cannot open the group chat', true);
  end;

  select count(*) = 0 into ok from public.messages m
    join public.conversations c on c.id = m.conversation_id
   where c.type = 'group';
  perform pg_temp.report('a non-member cannot read group chat history', ok);
end $$;
reset role;

-- Joining the group grants the chat; leaving takes it away again.
select pg_temp.as_user('ffffffff-0000-0000-0000-000000000003');
insert into public.group_members (group_id, user_id, role, status)
values ('99999999-0000-0000-0000-00000000000a','ffffffff-0000-0000-0000-000000000003','member','active');

do $$
declare ok boolean;
begin
  select count(*) > 0 into ok from public.messages m
    join public.conversations c on c.id = m.conversation_id
   where c.type = 'group';
  perform pg_temp.report('joining the group grants access to its chat', ok);
end $$;

delete from public.group_members
 where group_id = '99999999-0000-0000-0000-00000000000a'
   and user_id = 'ffffffff-0000-0000-0000-000000000003';

do $$
declare ok boolean;
begin
  select count(*) = 0 into ok from public.messages m
    join public.conversations c on c.id = m.conversation_id
   where c.type = 'group';
  perform pg_temp.report('leaving the group revokes chat access immediately', ok);
end $$;
reset role;

do $$ begin raise notice ''; end $$;

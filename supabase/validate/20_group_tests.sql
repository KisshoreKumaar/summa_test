-- ============================================================================
-- Behavioural tests for the Phase 3 group policies and triggers.
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

-- Fixtures: three onboarded students, two sharing a branch+year.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','g1@college-domain.edu','{"full_name":"Gina"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002','g2@college-domain.edu','{"full_name":"Hari"}'),
  ('aaaaaaaa-0000-0000-0000-000000000003','g3@college-domain.edu','{"full_name":"Ivan"}');

do $$ begin raise notice ''; raise notice 'Auto batch groups:'; end $$;

update public.profiles set onboarded_at = now(), branch = 'Computer Science', year = 2
 where id in ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002');
update public.profiles set onboarded_at = now(), branch = 'Design', year = 1
 where id = 'aaaaaaaa-0000-0000-0000-000000000003';

do $$
declare ok boolean;
begin
  select count(*) = 1 into ok from public.groups
   where category = 'batch' and batch_branch = 'Computer Science' and batch_year = 2;
  perform pg_temp.report('a batch group is created once for a branch+year', ok);

  select count(*) = 2 into ok from public.group_members m
    join public.groups g on g.id = m.group_id
   where g.category = 'batch' and g.batch_branch = 'Computer Science' and g.batch_year = 2;
  perform pg_temp.report('both same-branch students are enrolled in it', ok);

  select count(*) = 1 into ok from public.group_members m
    join public.groups g on g.id = m.group_id
   where g.category = 'batch' and m.user_id = 'aaaaaaaa-0000-0000-0000-000000000003';
  perform pg_temp.report('a different branch gets its own batch group', ok);
end $$;

-- Moving up a year should move the student across batch groups.
update public.profiles set year = 3 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare ok boolean;
begin
  select count(*) = 1 into ok from public.group_members m
    join public.groups g on g.id = m.group_id
   where g.category = 'batch' and m.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and g.batch_year = 3;
  perform pg_temp.report('changing year moves the student to the new batch group', ok);

  select count(*) = 0 into ok from public.group_members m
    join public.groups g on g.id = m.group_id
   where g.category = 'batch' and m.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and g.batch_year = 2;
  perform pg_temp.report('and out of the old one', ok);
end $$;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Group creation and joining:'; end $$;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.groups (id, name, description, type, category, created_by)
values ('bbbbbbbb-0000-0000-0000-00000000000a','Robotics Club','We build robots.','public','club',
        'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.groups (id, name, description, type, category, created_by)
values ('bbbbbbbb-0000-0000-0000-00000000000b','Thesis Group','Private workspace.','private','project',
        'aaaaaaaa-0000-0000-0000-000000000001');
reset role;

do $$
declare ok boolean;
begin
  select role = 'owner' and status = 'active' into ok from public.group_members
   where group_id = 'bbbbbbbb-0000-0000-0000-00000000000a'
     and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.report('creating a group makes the creator its owner', coalesce(ok,false));
end $$;

-- A hand-made batch group must be refused.
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
do $$
begin
  begin
    insert into public.groups (name, type, category, created_by)
    values ('Fake Batch','public','batch','aaaaaaaa-0000-0000-0000-000000000002');
    perform pg_temp.report('batch groups cannot be created by hand', false);
  exception when insufficient_privilege then
    perform pg_temp.report('batch groups cannot be created by hand', true);
  end;
end $$;

-- Public group: instant join. Private group: pending only.
insert into public.group_members (group_id, user_id, role, status)
values ('bbbbbbbb-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000002','member','active');

do $$
begin
  begin
    insert into public.group_members (group_id, user_id, role, status)
    values ('bbbbbbbb-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000002','member','active');
    perform pg_temp.report('private group cannot be joined instantly', false);
  exception when insufficient_privilege then
    perform pg_temp.report('private group cannot be joined instantly', true);
  end;

  begin
    insert into public.group_members (group_id, user_id, role, status)
    values ('bbbbbbbb-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000002','member','pending');
    perform pg_temp.report('private group accepts a pending request', true);
  exception when insufficient_privilege then
    perform pg_temp.report('private group accepts a pending request', false);
  end;

  begin
    insert into public.group_members (group_id, user_id, role, status)
    values ('bbbbbbbb-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000003','admin','active');
    perform pg_temp.report('nobody can self-insert as admin', false);
  exception when insufficient_privilege then
    perform pg_temp.report('nobody can self-insert as admin', true);
  end;
end $$;
reset role;

do $$
declare ok boolean;
begin
  select count(*) >= 1 into ok from public.notifications
   where type = 'group_join_request' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.report('a pending request notifies the group owner', ok);
end $$;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Feed scoping:'; end $$;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.group_posts (id, group_id, author_id, content)
values ('cccccccc-0000-0000-0000-00000000000a','bbbbbbbb-0000-0000-0000-00000000000b',
        'aaaaaaaa-0000-0000-0000-000000000001','Members only.');
reset role;

-- Hari is only *pending* in that private group.
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
do $$
declare ok boolean; n int;
begin
  select count(*) = 0 into ok from public.group_posts
   where group_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  perform pg_temp.report('a pending member cannot read the group feed', ok);

  begin
    insert into public.group_posts (group_id, author_id, content)
    values ('bbbbbbbb-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000002','Hello?');
    perform pg_temp.report('a pending member cannot post', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a pending member cannot post', true);
  end;

  begin
    insert into public.group_post_comments (post_id, author_id, content)
    values ('cccccccc-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000002','Sneaky');
    perform pg_temp.report('a non-member cannot comment', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a non-member cannot comment', true);
  end;

  begin
    insert into public.group_post_likes (post_id, user_id)
    values ('cccccccc-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000002');
    perform pg_temp.report('a non-member cannot like', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a non-member cannot like', true);
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Approval:'; end $$;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  update public.group_members set status = 'active'
   where group_id = 'bbbbbbbb-0000-0000-0000-00000000000b'
     and user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.report('an owner can approve a pending request', n = 1);
end $$;
reset role;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
do $$
declare ok boolean;
begin
  select count(*) = 1 into ok from public.group_posts
   where group_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  perform pg_temp.report('an approved member can now read the feed', ok);
end $$;
reset role;

do $$
declare ok boolean;
begin
  select count(*) >= 1 into ok from public.notifications
   where type = 'group_join_approved' and user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  perform pg_temp.report('approval notifies the requester', ok);
end $$;

-- A non-admin must not be able to promote themselves.
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
do $$
declare n int;
begin
  update public.group_members set role = 'admin'
   where group_id = 'bbbbbbbb-0000-0000-0000-00000000000b'
     and user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.report('a member cannot promote themselves to admin', n = 0);
end $$;
reset role;

-- Moderation: a group admin can remove somebody else's post.
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
insert into public.group_posts (id, group_id, author_id, content)
values ('cccccccc-0000-0000-0000-00000000000b','bbbbbbbb-0000-0000-0000-00000000000b',
        'aaaaaaaa-0000-0000-0000-000000000002','My post.');
reset role;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  delete from public.group_posts where id = 'cccccccc-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  perform pg_temp.report('a group admin can moderate another member''s post', n = 1);
end $$;
reset role;

do $$ begin raise notice ''; end $$;

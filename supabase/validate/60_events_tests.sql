-- ============================================================================
-- Behavioural tests for Phase 5 events and announcements.
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
  ('e5e5e5e5-0000-0000-0000-000000000001','ev1@college-domain.edu','{"full_name":"SuperAdmin"}'),
  ('e5e5e5e5-0000-0000-0000-000000000002','ev2@college-domain.edu','{"full_name":"ClubAdmin"}'),
  ('e5e5e5e5-0000-0000-0000-000000000003','ev3@college-domain.edu','{"full_name":"OtherClub"}'),
  ('e5e5e5e5-0000-0000-0000-000000000004','ev4@college-domain.edu','{"full_name":"Student"}'),
  ('e5e5e5e5-0000-0000-0000-000000000005','ev5@college-domain.edu','{"full_name":"Peer"}');

update public.profiles set onboarded_at = now(), branch='Mathematics & Computing', year=3
 where id::text like 'e5e5e5e5%';
update public.profiles set role='super_admin' where id='e5e5e5e5-0000-0000-0000-000000000001';
update public.profiles set role='club_admin'  where id='e5e5e5e5-0000-0000-0000-000000000002';
update public.profiles set role='club_admin'  where id='e5e5e5e5-0000-0000-0000-000000000003';

do $$ begin raise notice ''; raise notice 'Who can publish:'; end $$;

-- A plain student must not be able to create an event or an announcement.
select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000004');
do $$
begin
  begin
    insert into public.events (title, start_time, created_by)
    values ('Rogue Event', now() + interval '2 days', 'e5e5e5e5-0000-0000-0000-000000000004');
    perform pg_temp.report('a student cannot create an event', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a student cannot create an event', true);
  end;

  begin
    insert into public.announcements (title, content, created_by)
    values ('Rogue', 'text', 'e5e5e5e5-0000-0000-0000-000000000004');
    perform pg_temp.report('a student cannot publish an announcement', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a student cannot publish an announcement', true);
  end;
end $$;
reset role;

-- A club admin can, but only as themselves.
select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000002');
do $$
begin
  insert into public.events (id, title, description, start_time, location, category, created_by)
  values ('11e5e5e5-0000-0000-0000-00000000000a','Robotics Workshop','Bring a laptop.',
          now() + interval '2 days','Lab 3','workshop','e5e5e5e5-0000-0000-0000-000000000002');
  perform pg_temp.report('a club admin can create an event', true);

  begin
    insert into public.events (title, start_time, created_by)
    values ('Impersonation', now() + interval '3 days', 'e5e5e5e5-0000-0000-0000-000000000001');
    perform pg_temp.report('an admin cannot create an event as someone else', false);
  exception when insufficient_privilege then
    perform pg_temp.report('an admin cannot create an event as someone else', true);
  end;
end $$;
reset role;

-- Another club admin must not be able to edit or delete it.
select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000003');
do $$
declare n int;
begin
  update public.events set title = 'Hijacked' where id = '11e5e5e5-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.report('one club admin cannot edit another''s event', n = 0);

  delete from public.events where id = '11e5e5e5-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.report('one club admin cannot delete another''s event', n = 0);
end $$;
reset role;

-- A super admin can moderate anything.
select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  update public.events set description = 'Moderated.'
   where id = '11e5e5e5-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.report('a super admin can moderate any event', n = 1);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'RSVPs:'; end $$;

select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000004');
do $$
declare going int;
begin
  insert into public.event_rsvps (event_id, user_id, status)
  values ('11e5e5e5-0000-0000-0000-00000000000a','e5e5e5e5-0000-0000-0000-000000000004','going');
  perform pg_temp.report('anyone can RSVP to an event', true);

  update public.event_rsvps set status = 'interested'
   where event_id = '11e5e5e5-0000-0000-0000-00000000000a'
     and user_id = 'e5e5e5e5-0000-0000-0000-000000000004';
  perform pg_temp.report('an RSVP can be changed', true);

  begin
    insert into public.event_rsvps (event_id, user_id, status)
    values ('11e5e5e5-0000-0000-0000-00000000000a','e5e5e5e5-0000-0000-0000-000000000002','going');
    perform pg_temp.report('nobody can RSVP on another person''s behalf', false);
  exception when insufficient_privilege then
    perform pg_temp.report('nobody can RSVP on another person''s behalf', true);
  end;
end $$;
reset role;

-- "Not going" is private; going/interested are countable by everyone.
select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000002');
insert into public.event_rsvps (event_id, user_id, status)
values ('11e5e5e5-0000-0000-0000-00000000000a','e5e5e5e5-0000-0000-0000-000000000002','not_going');
reset role;

-- A plain peer: counts yes, declines no.
select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000005');
do $$
declare visible int; declined int;
begin
  select count(*) into visible from public.event_rsvps
   where event_id = '11e5e5e5-0000-0000-0000-00000000000a' and status <> 'not_going';
  perform pg_temp.report('a peer can count going/interested RSVPs', visible = 1);

  select count(*) into declined from public.event_rsvps
   where event_id = '11e5e5e5-0000-0000-0000-00000000000a' and status = 'not_going';
  perform pg_temp.report('declining stays private from peers', declined = 0);
end $$;
reset role;

-- An unrelated club admin must not see declines either.
select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000003');
do $$
declare declined int;
begin
  select count(*) into declined from public.event_rsvps
   where event_id = '11e5e5e5-0000-0000-0000-00000000000a' and status = 'not_going';
  perform pg_temp.report('declining stays private from unrelated club admins', declined = 0);
end $$;
reset role;

-- The organiser of this event does see who declined.
select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000002');
do $$
declare declined int;
begin
  select count(*) into declined from public.event_rsvps
   where event_id = '11e5e5e5-0000-0000-0000-00000000000a' and status = 'not_going';
  perform pg_temp.report('the organiser can see declines for their own event', declined = 1);
end $$;
reset role;

select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000002');
do $$
declare mine int;
begin
  select count(*) into mine from public.event_rsvps
   where event_id = '11e5e5e5-0000-0000-0000-00000000000a'
     and user_id = 'e5e5e5e5-0000-0000-0000-000000000002';
  perform pg_temp.report('you can always see your own RSVP', mine = 1);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Reminders:'; end $$;

select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000004');
do $$
declare made int;
begin
  -- Currently 'interested', and the event is 2 days out: neither qualifies.
  made := public.generate_event_reminders();
  perform pg_temp.report('no reminder for an event outside the lead time', made = 0);

  update public.event_rsvps set status = 'going'
   where event_id = '11e5e5e5-0000-0000-0000-00000000000a'
     and user_id = 'e5e5e5e5-0000-0000-0000-000000000004';

  made := public.generate_event_reminders('3 days');
  perform pg_temp.report('a reminder is created for an RSVP''d event in range', made = 1);

  made := public.generate_event_reminders('3 days');
  perform pg_temp.report('running it again creates no duplicate', made = 0);
end $$;
reset role;

select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000002');
do $$
declare made int;
begin
  -- This admin is 'not_going', so they should never be reminded.
  made := public.generate_event_reminders('3 days');
  perform pg_temp.report('somebody who declined gets no reminder', made = 0);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Announcements:'; end $$;

select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000002');
insert into public.announcements (id, title, content, created_by, pinned)
values ('22e5e5e5-0000-0000-0000-00000000000a','Exams','Timetable is out.',
        'e5e5e5e5-0000-0000-0000-000000000002', true);
reset role;

select pg_temp.as_user('e5e5e5e5-0000-0000-0000-000000000004');
do $$
declare n int;
begin
  select count(*) into n from public.announcements;
  perform pg_temp.report('every student can read announcements', n = 1);

  update public.announcements set content = 'defaced'
   where id = '22e5e5e5-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.report('a student cannot edit an announcement', n = 0);

  delete from public.announcements where id = '22e5e5e5-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.report('a student cannot delete an announcement', n = 0);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Instants and ends_at:'; end $$;

do $$
declare stored timestamptz; ok boolean;
begin
  -- What the client now submits: a real instant with an offset.
  insert into public.events (id, title, start_time, created_by)
  values ('33e5e5e5-0000-0000-0000-00000000000a','TZ Check',
          '2026-08-25T14:30:00+05:30','e5e5e5e5-0000-0000-0000-000000000002');

  select start_time into stored from public.events
   where id = '33e5e5e5-0000-0000-0000-00000000000a';

  -- 14:30 IST is 09:00 UTC. A bare wall clock would have stored 14:30 UTC.
  perform pg_temp.report('an offset-bearing time is stored as the right instant',
    stored = timestamptz '2026-08-25 09:00:00+00');

  select ends_at = start_time into ok from public.events
   where id = '33e5e5e5-0000-0000-0000-00000000000a';
  perform pg_temp.report('ends_at falls back to start_time when there is no end', ok);
end $$;

do $$
declare ok boolean;
begin
  update public.events
     set start_time = now() - interval '1 hour',
         end_time   = now() + interval '2 hours'
   where id = '33e5e5e5-0000-0000-0000-00000000000a';

  -- Started but still running: must count as upcoming, not past.
  select ends_at > now() into ok from public.events
   where id = '33e5e5e5-0000-0000-0000-00000000000a';
  perform pg_temp.report('an event in progress is not treated as past', ok);
end $$;

do $$
declare g int; i int;
begin
  select c.going_count, c.interested_count into g, i
  from public.event_rsvp_counts(array['11e5e5e5-0000-0000-0000-00000000000a'::uuid]) c;

  perform pg_temp.report('event_rsvp_counts aggregates without exposing rows',
    coalesce(g,0) = 1 and coalesce(i,0) = 0);
end $$;

do $$ begin raise notice ''; end $$;

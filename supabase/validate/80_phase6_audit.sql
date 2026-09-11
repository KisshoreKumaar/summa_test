-- ============================================================================
-- Phase 6 audit probes. These assert DESIRED behaviour: a FAIL is a defect.
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
  ('a6a6a6a6-0000-0000-0000-000000000001','au1@college-domain.edu','{"full_name":"Coach"}'),
  ('a6a6a6a6-0000-0000-0000-000000000002','au2@college-domain.edu','{"full_name":"Pupil"}'),
  ('a6a6a6a6-0000-0000-0000-000000000003','au3@college-domain.edu','{"full_name":"Bystander"}');

update public.profiles set onboarded_at = now(), branch='Biotechnology', year=3
 where id::text like 'a6a6a6a6%';

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000001');
insert into public.mentors (user_id, expertise) values
  ('a6a6a6a6-0000-0000-0000-000000000001', array['Genomics']);
insert into public.mentor_availability (id, mentor_id, slot_start, slot_end) values
  ('b6b6b6b6-0000-0000-0000-00000000000a','a6a6a6a6-0000-0000-0000-000000000001',
   now() + interval '3 days', now() + interval '3 days 1 hour'),
  ('b6b6b6b6-0000-0000-0000-00000000000b','a6a6a6a6-0000-0000-0000-000000000001',
   now() + interval '4 days', now() + interval '4 days 1 hour');
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Mentorship state machine:'; end $$;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000002');
insert into public.mentorship_requests (id, mentor_id, mentee_id, message)
values ('c6c6c6c6-0000-0000-0000-00000000000a','a6a6a6a6-0000-0000-0000-000000000001',
        'a6a6a6a6-0000-0000-0000-000000000002','Please help');

do $$
declare n int;
begin
  -- The mentor has not accepted. A mentee should not be able to close it out.
  begin
    update public.mentorship_requests set status = 'completed'
     where id = 'c6c6c6c6-0000-0000-0000-00000000000a';
    get diagnostics n = row_count;
    perform pg_temp.report('a mentee cannot complete a request the mentor never accepted', n = 0);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('a mentee cannot complete a request the mentor never accepted', true);
  end;
end $$;
reset role;

-- The probe above may have left that request completed, so the booking probes
-- below use a fresh mentee with a cleanly accepted request.
insert into auth.users (id, email, raw_user_meta_data)
values ('a6a6a6a6-0000-0000-0000-000000000004','au4@college-domain.edu','{"full_name":"Booker"}');
update public.profiles set onboarded_at = now(), branch='Biotechnology', year=2
 where id = 'a6a6a6a6-0000-0000-0000-000000000004';

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000004');
insert into public.mentorship_requests (id, mentor_id, mentee_id, message)
values ('c6c6c6c6-0000-0000-0000-00000000000c','a6a6a6a6-0000-0000-0000-000000000001',
        'a6a6a6a6-0000-0000-0000-000000000004','Booking probe');
reset role;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000001');
update public.mentorship_requests set status = 'accepted'
 where id = 'c6c6c6c6-0000-0000-0000-00000000000c';
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Slot booking limits:'; end $$;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000004');
do $$
declare held int;
begin
  perform public.book_mentor_slot('b6b6b6b6-0000-0000-0000-00000000000a');

  -- A second live booking with the same mentor must be refused.
  begin
    perform public.book_mentor_slot('b6b6b6b6-0000-0000-0000-00000000000b');
  exception when unique_violation then
    null;
  end;

  select count(*) into held from public.mentor_availability
   where mentor_id = 'a6a6a6a6-0000-0000-0000-000000000001'
     and booked_by = 'a6a6a6a6-0000-0000-0000-000000000004';

  raise notice '        slots held by one mentee: %', held;
  perform pg_temp.report('one mentee cannot hold every slot a mentor offers', held <= 1);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Releasing somebody else''s booking:'; end $$;

-- A bystander with no relationship to this slot at all.
select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000003');
select public.release_mentor_slot('b6b6b6b6-0000-0000-0000-00000000000a');
reset role;

/*
 * Measured as the table owner, not as the bystander: RLS correctly hides both
 * rows from them, so reading back through RLS would report a false failure.
 */
do $$
declare linked uuid; still_booked boolean;
begin
  select is_booked into still_booked from public.mentor_availability
   where id = 'b6b6b6b6-0000-0000-0000-00000000000a';
  perform pg_temp.report('a bystander cannot free somebody else''s slot',
    coalesce(still_booked, false));

  select slot_id into linked from public.mentorship_requests
   where id = 'c6c6c6c6-0000-0000-0000-00000000000c';
  perform pg_temp.report('a bystander cannot unlink somebody else''s booking',
    linked is not null);
end $$;

-- ---------------------------------------------------------------------------
/*
 * The probe above happened to target a slot the request did not point at.
 * This one aims at the slot actually linked to the request, which is what the
 * unguarded second UPDATE inside release_mentor_slot would clear.
 */
do $$
declare linked uuid;
begin
  select slot_id into linked from public.mentorship_requests
   where id = 'c6c6c6c6-0000-0000-0000-00000000000c';
  perform set_config('probe.linked_slot', linked::text, false);
  raise notice '        request is linked to slot %', linked;
end $$;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000003');
select public.release_mentor_slot(current_setting('probe.linked_slot')::uuid);
reset role;

do $$
declare linked uuid; still_booked boolean;
begin
  select is_booked into still_booked from public.mentor_availability
   where id = current_setting('probe.linked_slot')::uuid;
  perform pg_temp.report('the linked slot stays booked after a bystander call',
    coalesce(still_booked, false));

  select slot_id into linked from public.mentorship_requests
   where id = 'c6c6c6c6-0000-0000-0000-00000000000c';
  perform pg_temp.report('a bystander cannot clear the link on a booking they do not own',
    linked is not null);
end $$;

do $$ begin raise notice ''; raise notice 'Declining:'; end $$;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000003');
insert into public.mentorship_requests (id, mentor_id, mentee_id, message)
values ('c6c6c6c6-0000-0000-0000-00000000000b','a6a6a6a6-0000-0000-0000-000000000001',
        'a6a6a6a6-0000-0000-0000-000000000003','Hello');
reset role;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000001');
update public.mentorship_requests set status = 'declined'
 where id = 'c6c6c6c6-0000-0000-0000-00000000000b';
reset role;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000003');
do $$
declare again int;
begin
  -- Immediately after being declined, with no cooling-off at all.
  insert into public.mentorship_requests (mentor_id, mentee_id, message)
  values ('a6a6a6a6-0000-0000-0000-000000000001','a6a6a6a6-0000-0000-0000-000000000003','Again');
  insert into public.mentorship_requests (mentor_id, mentee_id, message)
  select 'a6a6a6a6-0000-0000-0000-000000000001','a6a6a6a6-0000-0000-0000-000000000003','And again'
  where false;

  select count(*) into again from public.mentorship_requests
   where mentee_id = 'a6a6a6a6-0000-0000-0000-000000000003' and status = 'requested';
  perform pg_temp.report('a declined mentee cannot immediately re-request', again = 0);
exception when unique_violation or insufficient_privilege or check_violation then
  perform pg_temp.report('a declined mentee cannot immediately re-request', true);
end $$;
reset role;

-- The cooling-off must expire, not become a permanent ban.
do $$ begin
  update public.mentorship_requests
     set declined_at = now() - interval '45 days'
   where id = 'c6c6c6c6-0000-0000-0000-00000000000b';
end $$;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000003');
do $$
begin
  begin
    insert into public.mentorship_requests (mentor_id, mentee_id, message)
    values ('a6a6a6a6-0000-0000-0000-000000000001',
            'a6a6a6a6-0000-0000-0000-000000000003','Some time later');
    perform pg_temp.report('after the cooling-off period they can ask again', true);
  exception when others then
    perform pg_temp.report('after the cooling-off period they can ask again', false);
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Legal transitions still work:'; end $$;

insert into auth.users (id, email, raw_user_meta_data)
values ('a6a6a6a6-0000-0000-0000-000000000005','au5@college-domain.edu','{"full_name":"Normal"}');
update public.profiles set onboarded_at = now(), branch='Biotechnology', year=1
 where id = 'a6a6a6a6-0000-0000-0000-000000000005';

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000005');
insert into public.mentorship_requests (id, mentor_id, mentee_id, message)
values ('c6c6c6c6-0000-0000-0000-00000000000d','a6a6a6a6-0000-0000-0000-000000000001',
        'a6a6a6a6-0000-0000-0000-000000000005','Normal path');
reset role;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  update public.mentorship_requests set status = 'accepted'
   where id = 'c6c6c6c6-0000-0000-0000-00000000000d';
  get diagnostics n = row_count;
  perform pg_temp.report('the mentor can still accept a request', n = 1);
end $$;
reset role;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000005');
do $$
declare n int;
begin
  update public.mentorship_requests set status = 'completed'
   where id = 'c6c6c6c6-0000-0000-0000-00000000000d';
  get diagnostics n = row_count;
  perform pg_temp.report('a mentee can still complete an accepted mentorship', n = 1);
end $$;
reset role;

-- A mentor must not be able to skip acceptance either.
select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000005');
insert into public.mentorship_requests (id, mentor_id, mentee_id, message)
values ('c6c6c6c6-0000-0000-0000-00000000000e','a6a6a6a6-0000-0000-0000-000000000001',
        'a6a6a6a6-0000-0000-0000-000000000005','Skip test');
reset role;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  begin
    update public.mentorship_requests set status = 'completed'
     where id = 'c6c6c6c6-0000-0000-0000-00000000000e';
    get diagnostics n = row_count;
    perform pg_temp.report('a mentor cannot skip straight to completed', n = 0);
  exception when check_violation or insufficient_privilege then
    perform pg_temp.report('a mentor cannot skip straight to completed', true);
  end;
end $$;
reset role;

-- Releasing a booking you own must still work.
do $$ begin raise notice ''; raise notice 'Releasing your own booking:'; end $$;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000004');
select public.release_mentor_slot(current_setting('probe.linked_slot')::uuid);
reset role;

do $$
declare booked boolean; linked uuid;
begin
  select is_booked into booked from public.mentor_availability
   where id = current_setting('probe.linked_slot')::uuid;
  perform pg_temp.report('the booker can free their own slot', booked = false);

  select slot_id into linked from public.mentorship_requests
   where id = 'c6c6c6c6-0000-0000-0000-00000000000c';
  perform pg_temp.report('and the request link is cleared with it', linked is null);
end $$;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Directory polish:'; end $$;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  -- The directory excludes the caller; this lookup must not.
  select count(*) into n from public.get_mentor_profile('a6a6a6a6-0000-0000-0000-000000000001');
  perform pg_temp.report('a mentor can open their own mentor page', n = 1);
end $$;
reset role;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000005');
do $$
declare n int;
begin
  select count(*) into n from public.get_mentor_profile('a6a6a6a6-0000-0000-0000-000000000001');
  perform pg_temp.report('anyone can look up a mentor by id', n = 1);

  select count(*) into n from public.search_mentors(null, null, array['Biotechnology']);
  perform pg_temp.report('the directory filters by branch', n = 1);

  select count(*) into n from public.search_mentors(null, null, array['Civil Engineering']);
  perform pg_temp.report('an unmatched branch filter returns nobody', n = 0);
end $$;
reset role;

-- Pausing hides the row from strangers but not from the mentor or their mentees.
select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000001');
update public.mentors set is_active = false
 where user_id = 'a6a6a6a6-0000-0000-0000-000000000001';
reset role;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000005');
do $$
declare n int;
begin
  select count(*) into n from public.mentors
   where user_id = 'a6a6a6a6-0000-0000-0000-000000000001';
  perform pg_temp.report('a paused mentor is not readable by a stranger', n = 0);
end $$;
reset role;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000004');
do $$
declare n int;
begin
  select count(*) into n from public.mentors
   where user_id = 'a6a6a6a6-0000-0000-0000-000000000001';
  perform pg_temp.report('their accepted mentee can still see them', n = 1);
end $$;
reset role;

select pg_temp.as_user('a6a6a6a6-0000-0000-0000-000000000001');
update public.mentors set is_active = true
 where user_id = 'a6a6a6a6-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Slot hygiene:'; end $$;

do $$
begin
  begin
    insert into public.mentor_availability (mentor_id, slot_start, slot_end)
    values ('a6a6a6a6-0000-0000-0000-000000000001',
            now() - interval '2 days', now() - interval '2 days' + interval '1 hour');
    perform pg_temp.report('a slot cannot be published in the past', false);
  exception when insufficient_privilege then
    perform pg_temp.report('a slot cannot be published in the past', true);
  end;

  begin
    -- Overlaps the 3-days-out slot created at the top of this file.
    insert into public.mentor_availability (mentor_id, slot_start, slot_end)
    values ('a6a6a6a6-0000-0000-0000-000000000001',
            now() + interval '3 days 30 minutes', now() + interval '3 days 90 minutes');
    perform pg_temp.report('overlapping slots are rejected', false);
  exception when exclusion_violation then
    perform pg_temp.report('overlapping slots are rejected', true);
  end;

  begin
    insert into public.mentor_availability (mentor_id, slot_start, slot_end)
    values ('a6a6a6a6-0000-0000-0000-000000000001',
            now() + interval '10 days', now() + interval '10 days 1 hour');
    perform pg_temp.report('a non-overlapping future slot is still accepted', true);
  exception when others then
    perform pg_temp.report('a non-overlapping future slot is still accepted', false);
  end;
end $$;
reset role;

do $$ begin raise notice ''; end $$;

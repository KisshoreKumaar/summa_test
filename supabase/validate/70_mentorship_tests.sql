-- ============================================================================
-- Behavioural tests for Phase 6 mentorship.
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
  ('60606060-0000-0000-0000-000000000001','mn1@college-domain.edu','{"full_name":"Mentor"}'),
  ('60606060-0000-0000-0000-000000000002','mn2@college-domain.edu','{"full_name":"Mentee"}'),
  ('60606060-0000-0000-0000-000000000003','mn3@college-domain.edu','{"full_name":"Rival"}'),
  ('60606060-0000-0000-0000-000000000004','mn4@college-domain.edu','{"full_name":"Nosy"}');

update public.profiles set onboarded_at = now(), branch='Electrical Engineering', year=4
 where id::text like '60606060%';
-- The mentor keeps a restricted profile, to prove the directory still lists them.
update public.profiles set visibility = 'connections'
 where id = '60606060-0000-0000-0000-000000000001';

do $$ begin raise notice ''; raise notice 'Opting in:'; end $$;

select pg_temp.as_user('60606060-0000-0000-0000-000000000001');
insert into public.mentors (user_id, expertise, bio)
values ('60606060-0000-0000-0000-000000000001', array['Machine Learning','Python'],
        'Happy to help with ML projects.');
reset role;

select pg_temp.as_user('60606060-0000-0000-0000-000000000002');
do $$
begin
  begin
    insert into public.mentors (user_id, expertise)
    values ('60606060-0000-0000-0000-000000000001', array['Forged']);
    perform pg_temp.report('nobody can enrol someone else as a mentor', false);
  exception when insufficient_privilege or unique_violation then
    perform pg_temp.report('nobody can enrol someone else as a mentor', true);
  end;
end $$;

do $$
declare found int;
begin
  select count(*) into found from public.search_mentors()
   where user_id = '60606060-0000-0000-0000-000000000001';
  perform pg_temp.report('a mentor with a restricted profile still appears in the directory',
    found = 1);

  select count(*) into found from public.profiles
   where id = '60606060-0000-0000-0000-000000000001';
  perform pg_temp.report('their full profile row is still hidden by RLS', found = 0);

  select count(*) into found from public.search_mentors(null, array['Machine Learning']);
  perform pg_temp.report('the directory filters by expertise', found = 1);

  select count(*) into found from public.search_mentors(null, array['Underwater Basket Weaving']);
  perform pg_temp.report('an unmatched expertise filter returns nobody', found = 0);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Requesting:'; end $$;

select pg_temp.as_user('60606060-0000-0000-0000-000000000002');
insert into public.mentorship_requests (id, mentor_id, mentee_id, message)
values ('70707070-0000-0000-0000-00000000000a','60606060-0000-0000-0000-000000000001',
        '60606060-0000-0000-0000-000000000002','Could you look over my project?');

do $$
declare n int;
begin
  begin
    insert into public.mentorship_requests (mentor_id, mentee_id, message, status)
    values ('60606060-0000-0000-0000-000000000001','60606060-0000-0000-0000-000000000002',
            'Again', 'accepted');
    perform pg_temp.report('a mentee cannot accept their own request', false);
  exception when insufficient_privilege or unique_violation then
    perform pg_temp.report('a mentee cannot accept their own request', true);
  end;

  -- A with-check violation raises rather than filtering, so accept either.
  begin
    update public.mentorship_requests set status = 'accepted'
     where id = '70707070-0000-0000-0000-00000000000a';
    get diagnostics n = row_count;
    perform pg_temp.report('a mentee cannot self-accept an existing request', n = 0);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('a mentee cannot self-accept an existing request', true);
  end;
end $$;
reset role;

do $$
declare ok boolean;
begin
  select count(*) = 1 into ok from public.notifications
   where type = 'mentorship_request' and user_id = '60606060-0000-0000-0000-000000000001';
  perform pg_temp.report('the mentor is notified of the request', ok);
end $$;

-- An unrelated student must not be able to read the thread.
select pg_temp.as_user('60606060-0000-0000-0000-000000000004');
do $$
declare n int;
begin
  select count(*) into n from public.mentorship_requests;
  perform pg_temp.report('an unrelated student cannot read a mentorship request', n = 0);
end $$;
reset role;

-- The mentor accepts.
select pg_temp.as_user('60606060-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  update public.mentorship_requests set status = 'accepted'
   where id = '70707070-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.report('the mentor can accept', n = 1);
end $$;
reset role;

do $$
declare ok boolean;
begin
  select count(*) = 1 into ok from public.notifications
   where type = 'mentorship_accepted' and user_id = '60606060-0000-0000-0000-000000000002';
  perform pg_temp.report('the mentee is notified of the acceptance', ok);
end $$;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Scheduling:'; end $$;

select pg_temp.as_user('60606060-0000-0000-0000-000000000001');
insert into public.mentor_availability (id, mentor_id, slot_start, slot_end)
values ('80808080-0000-0000-0000-00000000000a','60606060-0000-0000-0000-000000000001',
        now() + interval '2 days', now() + interval '2 days 1 hour');
reset role;

-- Someone with no accepted mentorship must not be able to book.
select pg_temp.as_user('60606060-0000-0000-0000-000000000003');
do $$
begin
  begin
    perform public.book_mentor_slot('80808080-0000-0000-0000-00000000000a');
    perform pg_temp.report('booking requires an accepted mentorship', false);
  exception when insufficient_privilege then
    perform pg_temp.report('booking requires an accepted mentorship', true);
  end;
end $$;
reset role;

select pg_temp.as_user('60606060-0000-0000-0000-000000000002');
do $$
declare booked uuid; ok boolean;
begin
  booked := public.book_mentor_slot('80808080-0000-0000-0000-00000000000a');
  perform pg_temp.report('an accepted mentee can book a slot', booked is not null);

  select slot_id = '80808080-0000-0000-0000-00000000000a' into ok
   from public.mentorship_requests where id = '70707070-0000-0000-0000-00000000000a';
  perform pg_temp.report('booking is recorded against the request', coalesce(ok,false));
end $$;
reset role;

-- The rival now has an accepted mentorship too, and races for the same slot.
select pg_temp.as_user('60606060-0000-0000-0000-000000000003');
insert into public.mentorship_requests (mentor_id, mentee_id, message)
values ('60606060-0000-0000-0000-000000000001','60606060-0000-0000-0000-000000000003','Me too');
reset role;

select pg_temp.as_user('60606060-0000-0000-0000-000000000001');
update public.mentorship_requests set status = 'accepted'
 where mentee_id = '60606060-0000-0000-0000-000000000003';
reset role;

select pg_temp.as_user('60606060-0000-0000-0000-000000000003');
do $$
begin
  begin
    perform public.book_mentor_slot('80808080-0000-0000-0000-00000000000a');
    perform pg_temp.report('a slot cannot be double-booked', false);
  exception when unique_violation then
    perform pg_temp.report('a slot cannot be double-booked', true);
  end;
end $$;
reset role;

-- Who booked a slot is not public.
select pg_temp.as_user('60606060-0000-0000-0000-000000000004');
do $$
declare n int;
begin
  select count(*) into n from public.mentor_availability
   where id = '80808080-0000-0000-0000-00000000000a';
  perform pg_temp.report('a booked slot is hidden from unrelated students', n = 0);
end $$;
reset role;

select pg_temp.as_user('60606060-0000-0000-0000-000000000002');
do $$
declare n int;
begin
  select count(*) into n from public.mentor_availability
   where id = '80808080-0000-0000-0000-00000000000a';
  perform pg_temp.report('the person who booked it can still see it', n = 1);
end $$;
reset role;

-- ---------------------------------------------------------------------------
do $$ begin raise notice ''; raise notice 'Completing:'; end $$;

select pg_temp.as_user('60606060-0000-0000-0000-000000000002');
do $$
declare n int;
begin
  update public.mentorship_requests set status = 'completed'
   where id = '70707070-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.report('either side can mark a mentorship completed', n = 1);

  begin
    update public.mentorship_requests set status = 'accepted'
     where id = '70707070-0000-0000-0000-00000000000a';
    get diagnostics n = row_count;
    perform pg_temp.report('a completed mentorship cannot be reopened', n = 0);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.report('a completed mentorship cannot be reopened', true);
  end;
end $$;
reset role;

do $$ begin raise notice ''; end $$;

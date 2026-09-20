-- Demo data for FY 2026-27 (the fiscal year runs July through June).

insert into goals (code, section, label, federal, sort) values
  ('A1', 'Economic', 'Enter employment', true, 1),
  ('A2', 'Economic', 'Retain employment', true, 2),
  ('A3', 'Economic', 'Leave public assistance', false, 3),
  ('B1', 'Educational', 'Achieve work-based project learner goal', false, 4),
  ('B2', 'Educational', 'Enter occupational skills training program', true, 5),
  ('B3', 'Educational', 'Enter postsecondary education', true, 6),
  ('B4', 'Educational', 'Obtain high school diploma', true, 7),
  ('C1', 'Family', 'Help more frequently with school', false, 8),
  ('C2', 'Family', 'Increase contact with child(ren)''s teachers', false, 9),
  ('C3', 'Family', 'More involvement in child(ren)''s school activities', false, 10),
  ('C4', 'Family', 'Purchase books or magazines', false, 11),
  ('C5', 'Family', 'Read to child(ren)', false, 12),
  ('C6', 'Family', 'Visit the library (with/for child(ren))', false, 13),
  ('D1', 'Societal/Community', 'Obtain citizenship', true, 14),
  ('D2', 'Societal/Community', 'Achieve civics skills', false, 15),
  ('D3', 'Societal/Community', 'Increase involvement in community activities', false, 16),
  ('D4', 'Societal/Community', 'Vote or register to vote', false, 17);

insert into sites (name, address, is_remote) values
  ('Bloomfield Public Library', '90 Broad Street, Bloomfield, NJ 07003', false),
  ('Passaic Public Library', '195 Gregory Avenue, Passaic, NJ 07055', false),
  ('Maplewood Memorial Library', '51 Baker Street, Maplewood, NJ 07040', false),
  ('Irvington Public Library', '5 Civic Square, Irvington, NJ 07111', false),
  ('Remote', null, true);

insert into tutors (name, email, phone, started_on) values
  ('Judy Tabs', 'judy.tabs@example.org', '973-555-0142', '2024-09-03'),
  ('Howard Gardner', 'howard.gardner@example.org', '973-555-0188', '2023-01-16'),
  ('Cheryl Locastro', 'cheryl.locastro@example.org', '973-555-0119', '2025-06-02');

insert into students (name, program, bio, native_language, enrolled_on) values
  ('Mariella Andrade', 'esol',
   'Arrived from Ecuador in 2024. Works evenings at a bakery in Bloomfield and is studying to pass the citizenship interview.',
   'Spanish', '2026-07-08'),
  ('Samuel Okafor', 'basic_literacy',
   'Lifelong Newark resident returning to reading after leaving school in tenth grade. Wants to finish a high school diploma.',
   'English', '2026-07-15'),
  ('Rosa Delgado', 'family_literacy',
   'Mother of two elementary schoolers. Joined to read with her children and speak with their teachers without an interpreter.',
   'Spanish', '2026-07-08'),
  ('Tran Minh Hieu', 'esol',
   'Software technician from Da Nang. Strong written English, building confidence in workplace conversation.',
   'Vietnamese', '2026-08-05'),
  ('Yolanda Batista', 'esol',
   'Retired nurse from the Dominican Republic. Volunteers at her parish and wants to register to vote.',
   'Spanish', '2026-07-08'),
  ('Kwame Mensah', 'esol',
   'Recent arrival from Ghana, driving rideshare while looking for work in medical billing.',
   'Twi', '2026-08-19');

-- A small group of four plus two one-on-one pairs, matching how LVAEP actually
-- pairs tutors: some groups, some individuals, one remote.
insert into groups (tutor_id, name, kind, site_id, program, meets_days, meets_time, expected_weekly_hours, started_on)
select
  t.id, g.name, g.kind::group_kind, s.id, g.program::program, g.days, g.time, g.hours, g.started
from (values
  ('Howard Gardner', 'Tuesday ESOL Conversation', 'group', 'Bloomfield Public Library', 'esol',
   array['Tue'], '6:00 PM', 2.0, date '2026-07-07'),
  ('Judy Tabs', 'Mariella Andrade (1:1)', 'individual', 'Bloomfield Public Library', 'esol',
   array['Mon', 'Wed'], '10:00 AM', 2.0, date '2026-07-08'),
  ('Judy Tabs', 'Samuel Okafor (1:1)', 'individual', 'Irvington Public Library', 'basic_literacy',
   array['Thu'], '5:30 PM', 2.0, date '2026-07-16'),
  ('Cheryl Locastro', 'Online ESOL Class', 'group', 'Remote', 'esol',
   array['Sat'], '9:00 AM', 2.0, date '2026-08-08')
) as g(tutor, name, kind, site, program, days, time, hours, started)
join tutors t on t.name = g.tutor
join sites s on s.name = g.site;

insert into group_members (group_id, student_id, joined_on)
select gr.id, st.id, gr.started_on
from (values
  ('Tuesday ESOL Conversation', 'Mariella Andrade'),
  ('Tuesday ESOL Conversation', 'Rosa Delgado'),
  ('Tuesday ESOL Conversation', 'Yolanda Batista'),
  ('Tuesday ESOL Conversation', 'Tran Minh Hieu'),
  ('Mariella Andrade (1:1)', 'Mariella Andrade'),
  ('Samuel Okafor (1:1)', 'Samuel Okafor'),
  ('Online ESOL Class', 'Tran Minh Hieu'),
  ('Online ESOL Class', 'Kwame Mensah')
) as m(group_name, student_name)
join groups gr on gr.name = m.group_name
join students st on st.name = m.student_name;

-- Generate the recurring sessions each group's schedule implies, from the
-- group's start date through today.
insert into sessions (group_id, date, scheduled_hours, mode, site_id, logged_by, notes)
select
  gr.id,
  d::date,
  gr.expected_weekly_hours,
  case when si.is_remote then 'remote' else 'in_person' end::session_mode,
  gr.site_id,
  gr.tutor_id,
  null
from groups gr
join sites si on si.id = gr.site_id
cross join lateral generate_series(gr.started_on, current_date, interval '1 day') as d
where to_char(d, 'Dy') = any (gr.meets_days);

-- One attendance row per enrolled student per session. The pattern is
-- deterministic so the seeded numbers stay stable: a scattering of student
-- absences, one tutor absence, and Labor Day as a holiday.
insert into attendance (session_id, student_id, status, hours, note)
select
  se.id,
  gm.student_id,
  st.status::attendance_status,
  case when st.status = 'present' then se.scheduled_hours else 0 end,
  case when st.status = 'holiday' then 'Labor Day — site closed' else null end
from sessions se
join group_members gm on gm.group_id = se.group_id
cross join lateral (
  -- Hashed on student and date together: a weekly group's sessions all share a
  -- day-of-week, so anything keyed off the date alone would hand every session
  -- in a series the same status.
  select ('x' || substr(md5(gm.student_id::text || se.date::text), 1, 8))::bit(32)::bigint % 100 as roll
) h
cross join lateral (
  select case
    when se.date = date '2026-09-07' then 'holiday'
    when abs(h.roll) < 6 then 'tutor_absent'
    when abs(h.roll) < 22 then 'student_absent'
    else 'present'
  end as status
) st;

-- Goal states. The point of tracking a baseline is that a goal the student
-- already met at intake is not a gain and must never be reported as one.
insert into student_goals (student_id, goal_code, status, baseline_note, attained_on, evidence)
select st.id, g.code, g.status::goal_status, g.baseline, g.attained, g.evidence
from (values
  ('Mariella Andrade', 'D1', 'targeted', 'Green card holder since 2024; eligible to apply.', null::date, null),
  ('Mariella Andrade', 'D2', 'attained', null, date '2026-09-02', 'Passed practice civics test, 92/100.'),
  ('Mariella Andrade', 'A1', 'already_had', 'Employed at a bakery at intake — not a reportable gain.', null, null),
  ('Mariella Andrade', 'C5', 'not_applicable', 'No children.', null, null),
  ('Samuel Okafor', 'B4', 'targeted', 'Left school in tenth grade.', null, null),
  ('Samuel Okafor', 'A1', 'attained', 'Unemployed at intake.', date '2026-08-24', 'Started warehouse role, 30 hrs/week.'),
  ('Samuel Okafor', 'D4', 'already_had', 'Registered to vote before enrolling.', null, null),
  ('Rosa Delgado', 'C1', 'attained', null, date '2026-08-12', 'Now reviews homework nightly with both children.'),
  ('Rosa Delgado', 'C2', 'targeted', 'Used an interpreter for conferences at intake.', null, null),
  ('Rosa Delgado', 'C6', 'attained', null, date '2026-07-29', 'Library cards issued for both children.'),
  ('Rosa Delgado', 'D1', 'not_applicable', 'Already a citizen.', null, null),
  ('Tran Minh Hieu', 'B2', 'targeted', null, null, null),
  ('Tran Minh Hieu', 'A2', 'already_had', 'Employed at intake and staying in role.', null, null),
  ('Yolanda Batista', 'D4', 'targeted', 'Citizen, never registered.', null, null),
  ('Yolanda Batista', 'D3', 'attained', null, date '2026-09-09', 'Leads a parish reading circle.'),
  ('Kwame Mensah', 'A1', 'targeted', 'Driving rideshare part time at intake.', null, null),
  ('Kwame Mensah', 'B2', 'targeted', 'Pursuing medical billing certification.', null, null)
) as g(student, code, status, baseline, attained, evidence)
join students st on st.name = g.student;

insert into student_goals (student_id, custom_label, status, attained_on, evidence)
select st.id, 'Open a checking account', 'attained', date '2026-08-05', 'Account opened at a Bloomfield credit union.'
from students st where st.name = 'Kwame Mensah';

-- July and August are closed and locked; September is still open.
insert into monthly_submissions (student_id, month, submitted_by, locked)
select distinct st.id, m.month, gr.tutor_id, true
from students st
join group_members gm on gm.student_id = st.id
join groups gr on gr.id = gm.group_id
cross join (values (date '2026-07-01'), (date '2026-08-01')) as m(month)
where st.enrolled_on < m.month + interval '1 month'
on conflict (student_id, month) do nothing;

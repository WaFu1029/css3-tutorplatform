-- LVAEP tutoring log — initial schema.
--
-- Core shape: a session belongs to a group and fans out into one attendance row
-- per enrolled student. A one-on-one pair is a group of kind 'individual' with a
-- single member, so group and 1:1 tutoring share one code path.

create extension if not exists "pgcrypto";

create type program as enum ('basic_literacy', 'esol', 'family_literacy');
create type group_kind as enum ('individual', 'group');
create type session_mode as enum ('in_person', 'remote');

-- Mirrors the TA/SA/H codes on the paper form. 'present' is the fourth state the
-- paper form expresses by writing a number in the box.
create type attendance_status as enum ('present', 'student_absent', 'tutor_absent', 'holiday');

-- Federal goals are reported as gains during the year, so a goal the student had
-- at intake ('already_had') is never reportable and must be distinguished from
-- one they are working toward ('targeted').
create type goal_status as enum ('not_applicable', 'already_had', 'targeted', 'attained');

create table sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  is_remote boolean not null default false
);

create table tutors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  started_on date not null default current_date,
  -- The tutor agreement commits volunteers to two instructional hours a week.
  weekly_hours_committed numeric(4, 2) not null default 2,
  active boolean not null default true
);

create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  program program not null,
  bio text,
  native_language text,
  enrolled_on date not null default current_date,
  stopped_on date,
  stopped_reason text,
  constraint stopped_needs_date check (stopped_reason is null or stopped_on is not null)
);

-- The achievement checklist from the paper form. Goals marked federal carry an
-- asterisk on the printed sheet: they are reported to the state.
create table goals (
  code text primary key,
  section text not null,
  label text not null,
  federal boolean not null default false,
  sort integer not null
);

create table student_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  goal_code text references goals (code),
  -- Section E of the paper form lets tutors write in their own goal.
  custom_label text,
  status goal_status not null default 'targeted',
  baseline_note text,
  attained_on date,
  evidence text,
  updated_at timestamptz not null default now(),
  constraint one_of_goal_or_custom check ((goal_code is null) <> (custom_label is null)),
  constraint attained_needs_date check ((status = 'attained') = (attained_on is not null))
);

create unique index student_goals_catalog_key on student_goals (student_id, goal_code)
  where goal_code is not null;

create table groups (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete restrict,
  name text not null,
  kind group_kind not null default 'group',
  site_id uuid references sites (id),
  program program,
  -- The paper form's "Day(s)" and "Time(s)" fields, kept structured so expected
  -- sessions can be generated from the recurring schedule.
  meets_days text[] not null default '{}',
  meets_time text,
  expected_weekly_hours numeric(4, 2) not null default 2,
  started_on date not null default current_date,
  ended_on date
);

create table group_members (
  group_id uuid not null references groups (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  joined_on date not null default current_date,
  left_on date,
  primary key (group_id, student_id)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  date date not null,
  scheduled_hours numeric(4, 2) not null default 2,
  mode session_mode not null default 'in_person',
  site_id uuid references sites (id),
  notes text,
  logged_by uuid references tutors (id),
  logged_at timestamptz not null default now()
);

create index sessions_group_date on sessions (group_id, date);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  status attendance_status not null,
  hours numeric(4, 2) not null default 0,
  note text,
  unique (session_id, student_id),
  -- Hours are only earned when the student was present.
  constraint hours_match_status check ((status = 'present') = (hours > 0))
);

create index attendance_student on attendance (student_id);

-- A tutor's sign-off that one student's month is complete and ready to report.
create table monthly_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  month date not null,
  submitted_at timestamptz not null default now(),
  submitted_by uuid references tutors (id),
  locked boolean not null default true,
  unique (student_id, month)
);

-- Hours per student per month, the number the monthly report is built from.
create view student_month_hours as
select
  a.student_id,
  date_trunc('month', s.date)::date as month,
  sum(a.hours) as hours,
  count(*) filter (where a.status = 'present') as sessions_attended,
  count(*) filter (where a.status = 'student_absent') as student_absences,
  count(*) filter (where a.status = 'tutor_absent') as tutor_absences,
  count(*) filter (where a.status = 'holiday') as holidays
from attendance a
join sessions s on s.id = a.session_id
group by 1, 2;

-- Holidays leave the denominator; a tutor absence is not the student's failure
-- to show, so it is excluded from the student's own rate.
create view student_attendance_rate as
select
  a.student_id,
  count(*) filter (where a.status = 'present') as attended,
  count(*) filter (where a.status in ('present', 'student_absent')) as expected,
  round(
    100.0 * count(*) filter (where a.status = 'present')
      / nullif(count(*) filter (where a.status in ('present', 'student_absent')), 0),
    1
  ) as rate_pct
from attendance a
group by 1;

-- Student records are sensitive. Row level security is on with no policies yet,
-- which denies all access until tutor and staff roles are wired up.
alter table sites enable row level security;
alter table tutors enable row level security;
alter table students enable row level security;
alter table goals enable row level security;
alter table student_goals enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table sessions enable row level security;
alter table attendance enable row level security;
alter table monthly_submissions enable row level security;

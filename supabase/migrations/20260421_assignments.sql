-- ============================================================
-- Redacción · Session 1
-- Creates assignments, attempts, and corrections tables with RLS
-- and cascade deletes down from lesson → assignment → attempt → correction.
-- Session 1 only populates `assignments` (via mocked API).
-- attempts and corrections are filled by later sessions.
-- ============================================================

-- Assignments: one writing task per lesson, per user.
create table public.assignments (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  scope       text not null check (scope in ('single_lesson', 'unit')),
  title       text not null,
  brief       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_assignments_lesson_user on public.assignments(lesson_id, user_id);
create index idx_assignments_user_created on public.assignments(user_id, created_at desc);

-- Attempts: versioned drafts/submissions for an assignment (populated in Session 3).
create table public.attempts (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references public.assignments(id) on delete cascade,
  version_number  integer not null,
  essay           text not null default '',
  word_count      integer not null default 0,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (assignment_id, version_number)
);

create index idx_attempts_assignment on public.attempts(assignment_id);

-- Corrections: one correction per attempt (populated in Session 4).
create table public.corrections (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null unique references public.attempts(id) on delete cascade,
  segments         jsonb not null default '[]'::jsonb,
  summary          text not null default '',
  score_grammar    integer,
  score_vocabulary integer,
  score_structure  integer,
  created_at       timestamptz not null default now()
);

-- RLS
alter table public.assignments enable row level security;
alter table public.attempts    enable row level security;
alter table public.corrections enable row level security;

create policy "Users manage own assignments" on public.assignments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Attempts inherit ownership via the parent assignment.
create policy "Users manage attempts on own assignments" on public.attempts
  for all
  using (exists (
    select 1 from public.assignments a
    where a.id = assignment_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.assignments a
    where a.id = assignment_id and a.user_id = auth.uid()
  ));

-- Corrections inherit ownership via the attempt → assignment chain.
create policy "Users manage corrections on own attempts" on public.corrections
  for all
  using (exists (
    select 1
    from public.attempts at
    join public.assignments a on a.id = at.assignment_id
    where at.id = attempt_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.attempts at
    join public.assignments a on a.id = at.assignment_id
    where at.id = attempt_id and a.user_id = auth.uid()
  ));

-- Weeks table
create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_number integer not null,
  title text not null default '',
  markdown_content text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, week_number)
);

-- Lessons table
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_id uuid not null references public.weeks(id) on delete cascade,
  title text not null,
  markdown_content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index idx_weeks_user on public.weeks(user_id);
create index idx_lessons_week on public.lessons(week_id);
create index idx_lessons_user on public.lessons(user_id);

-- Full-text search index on lessons
alter table public.lessons add column fts tsvector
  generated always as (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(markdown_content, ''))) stored;
create index idx_lessons_fts on public.lessons using gin(fts);

-- RLS
alter table public.weeks enable row level security;
alter table public.lessons enable row level security;

create policy "Users manage own weeks" on public.weeks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own lessons" on public.lessons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Search function for ts_headline support
create or replace function search_lessons(search_query text)
returns table (
  id uuid,
  title text,
  week_id uuid,
  week_number integer,
  week_title text,
  headline text
)
language sql
security definer
as $$
  select
    l.id,
    l.title,
    l.week_id,
    w.week_number,
    w.title as week_title,
    ts_headline('spanish', l.markdown_content, plainto_tsquery('spanish', search_query),
      'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>') as headline
  from public.lessons l
  join public.weeks w on w.id = l.week_id
  where l.user_id = auth.uid()
    and l.fts @@ plainto_tsquery('spanish', search_query)
  order by ts_rank(l.fts, plainto_tsquery('spanish', search_query)) desc;
$$;

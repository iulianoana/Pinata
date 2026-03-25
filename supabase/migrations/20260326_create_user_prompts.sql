create table user_prompts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  group_key text not null,
  slug text not null,
  name text not null,
  filename text not null,
  content text not null,
  previous_content text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, group_key, slug)
);

alter table user_prompts enable row level security;

create policy "Users can read own prompts"
  on user_prompts for select using (auth.uid() = user_id);

create policy "Users can insert own prompts"
  on user_prompts for insert with check (auth.uid() = user_id);

create policy "Users can update own prompts"
  on user_prompts for update using (auth.uid() = user_id);

create policy "Users can delete own prompts"
  on user_prompts for delete using (auth.uid() = user_id);

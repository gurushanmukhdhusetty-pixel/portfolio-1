-- Life OS — initial schema
-- Every table is owned by one auth user and protected by row-level security.
-- board_id NULL on notes / todos = Inbox (quick capture, board chosen later).

create extension if not exists pgcrypto;

-- updated_at helper -----------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- BOARDS ----------------------------------------------------------------------
-- kind decides which extra modules a board gets:
--   academics -> goals, courses, grades, assessments
--   content   -> goals, pipeline (pieces + claims)
--   personal  -> goals, people/birthdays, habits
--   standard  -> only the 4 core tabs (Cinematy, Morphius AI, custom boards)
create table public.boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  kind        text not null default 'standard'
              check (kind in ('standard','academics','content','personal')),
  role        text,                       -- e.g. 'Founder', 'Chief Strategy Officer'
  color       text not null default '#6366f1',
  icon        text not null default 'folder',
  position    int  not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- NOTES -----------------------------------------------------------------------
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  board_id    uuid references public.boards on delete cascade,   -- null = inbox
  person_id   uuid,                                              -- fk added below
  title       text not null default '',
  content     text not null default '',                          -- HTML from rich-text editor
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- CHECKLISTS --------------------------------------------------------------------
create table public.checklists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  board_id    uuid not null references public.boards on delete cascade,
  title       text not null,
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  checklist_id uuid not null references public.checklists on delete cascade,
  text         text not null,
  done         boolean not null default false,
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- GOALS (Academics, Content, Personal) ------------------------------------------
-- progress is computed in the app: done linked todos / all linked todos
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  board_id    uuid not null references public.boards on delete cascade,
  title       text not null,
  description text not null default '',
  deadline    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- TODOS -------------------------------------------------------------------------
create table public.todos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  board_id     uuid references public.boards on delete cascade,  -- null = inbox
  parent_id    uuid references public.todos on delete cascade,   -- subtask of
  goal_id      uuid references public.goals on delete set null,
  title        text not null,
  details      text not null default '',
  due_date     date,
  priority     smallint not null default 2 check (priority between 1 and 3),
  status       text not null default 'todo' check (status in ('todo','doing','done')),
  recurrence   text not null default 'none'
               check (recurrence in ('none','daily','weekdays','weekly','monthly')),
  top3         smallint check (top3 between 1 and 3),           -- Today "Top 3" slot
  position     int  not null default 0,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- FILES & LINKS -------------------------------------------------------------------
create table public.files (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  board_id     uuid not null references public.boards on delete cascade,
  todo_id      uuid references public.todos on delete set null,   -- attached to a to-do
  kind         text not null default 'file' check (kind in ('file','link')),
  name         text not null,
  storage_path text,              -- kind = file: path inside the 'files' bucket
  url          text,              -- kind = link
  mime         text,
  size         bigint,
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ACADEMICS: courses, grade components, assessments -----------------------------
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  board_id     uuid not null references public.boards on delete cascade,
  name         text not null,
  code         text,
  target       numeric(5,2) not null default 80,   -- target overall %
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- weight = % of the course. item_count items, of which best_of count (null = all).
-- scores: json array, one entry per item: {"score": 8, "max": 10} or null if not yet graded.
create table public.grade_components (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  course_id    uuid not null references public.courses on delete cascade,
  name         text not null,
  weight       numeric(5,2) not null check (weight >= 0 and weight <= 100),
  item_count   int not null default 1 check (item_count >= 1),
  best_of      int check (best_of >= 1),
  scores       jsonb not null default '[]',
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.assessments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  board_id     uuid not null references public.boards on delete cascade,
  course_id    uuid references public.courses on delete cascade,
  title        text not null,
  type         text not null default 'quiz'
               check (type in ('quiz','exam','assignment','project','presentation','other')),
  due_at       timestamptz,
  done         boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- CONTENT: pipeline + sources/claims log ----------------------------------------------
create table public.content_pieces (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  board_id     uuid not null references public.boards on delete cascade,
  title        text not null,
  format       text not null default 'post' check (format in ('post','article','carousel','other')),
  stage        text not null default 'idea' check (stage in ('idea','drafting','published')),
  body         text not null default '',
  published_url text,
  published_at date,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.content_claims (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  piece_id     uuid not null references public.content_pieces on delete cascade,
  claim        text not null,
  number       text,              -- the stat as written, e.g. "42%" or "$1.2B"
  source_url   text,
  source_date  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- PERSONAL: people (birthdays + notes), habits ----------------------------------------
create table public.people (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  board_id     uuid not null references public.boards on delete cascade,
  name         text not null,
  relation     text,
  birth_month  smallint check (birth_month between 1 and 12),
  birth_day    smallint check (birth_day between 1 and 31),
  birth_year   smallint,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.notes
  add constraint notes_person_fk foreign key (person_id) references public.people on delete cascade;

create table public.habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  board_id     uuid not null references public.boards on delete cascade,
  name         text not null,
  archived     boolean not null default false,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.habit_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id     uuid not null references public.habits on delete cascade,
  day          date not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (habit_id, day)
);

-- Indexes, triggers, RLS for every table ---------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'boards','notes','checklists','checklist_items','goals','todos','files',
    'courses','grade_components','assessments','content_pieces','content_claims',
    'people','habits','habit_logs'
  ] loop
    execute format('create index on public.%I (user_id)', t);
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.touch_updated_at()', t || '_touch', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner" on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

create index on public.todos (due_date) where status <> 'done';
create index on public.todos (board_id);
create index on public.notes (board_id);
create index on public.files (board_id);

-- STORAGE: private bucket, each user only touches <their uid>/... -----------------------
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

create policy "files owner read" on storage.objects for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "files owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "files owner update" on storage.objects for update to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "files owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);

// Single source of truth for the database. DDL is generated from this, and the
// mutate endpoint only accepts table/column names listed here (no SQL injection).
// Every table also gets: id uuid pk, created_at, updated_at.

export const SCHEMA_VERSION = 1;

export const TABLES = {
  boards: {
    name: 'text not null',
    kind: "text not null default 'standard' check (kind in ('standard','academics','content','personal'))",
    role: 'text',
    color: "text not null default '#6366f1'",
    icon: "text not null default 'folder'",
    position: 'int not null default 0',
    archived: 'boolean not null default false',
  },
  people: {
    board_id: 'uuid not null references boards on delete cascade',
    name: 'text not null',
    relation: 'text',
    birth_month: 'smallint check (birth_month between 1 and 12)',
    birth_day: 'smallint check (birth_day between 1 and 31)',
    birth_year: 'smallint',
  },
  notes: {
    board_id: 'uuid references boards on delete cascade', // null = inbox
    person_id: 'uuid references people on delete cascade',
    title: "text not null default ''",
    content: "text not null default ''", // HTML
    pinned: 'boolean not null default false',
  },
  checklists: {
    board_id: 'uuid not null references boards on delete cascade',
    title: 'text not null',
    position: 'int not null default 0',
  },
  checklist_items: {
    checklist_id: 'uuid not null references checklists on delete cascade',
    text: 'text not null',
    done: 'boolean not null default false',
    position: 'int not null default 0',
  },
  goals: {
    board_id: 'uuid not null references boards on delete cascade',
    title: 'text not null',
    description: "text not null default ''",
    deadline: 'date',
  },
  todos: {
    board_id: 'uuid references boards on delete cascade', // null = inbox
    parent_id: 'uuid references todos on delete cascade', // subtask of
    goal_id: 'uuid references goals on delete set null',
    title: 'text not null',
    details: "text not null default ''",
    due_date: 'date',
    priority: 'smallint not null default 2 check (priority between 1 and 3)',
    status: "text not null default 'todo' check (status in ('todo','doing','done'))",
    recurrence: "text not null default 'none' check (recurrence in ('none','daily','weekdays','weekly','monthly'))",
    top3: 'smallint check (top3 between 1 and 3)',
    position: 'int not null default 0',
    completed_at: 'timestamptz',
  },
  files: {
    board_id: 'uuid not null references boards on delete cascade',
    todo_id: 'uuid references todos on delete set null',
    kind: "text not null default 'file' check (kind in ('file','link'))",
    name: 'text not null',
    storage_path: 'text',
    url: 'text',
    mime: 'text',
    size: 'bigint',
    tags: "text[] not null default '{}'",
  },
  courses: {
    board_id: 'uuid not null references boards on delete cascade',
    name: 'text not null',
    code: 'text',
    target: 'numeric(5,2) not null default 80',
    position: 'int not null default 0',
  },
  grade_components: {
    course_id: 'uuid not null references courses on delete cascade',
    name: 'text not null',
    weight: 'numeric(5,2) not null check (weight >= 0 and weight <= 100)',
    item_count: 'int not null default 1 check (item_count >= 1)',
    best_of: 'int check (best_of >= 1)',
    scores: "jsonb not null default '[]'", // [{score, max} | null] per item
    position: 'int not null default 0',
  },
  assessments: {
    board_id: 'uuid not null references boards on delete cascade',
    course_id: 'uuid references courses on delete cascade',
    title: 'text not null',
    type: "text not null default 'quiz' check (type in ('quiz','exam','assignment','project','presentation','other'))",
    due_at: 'timestamptz',
    done: 'boolean not null default false',
  },
  content_pieces: {
    board_id: 'uuid not null references boards on delete cascade',
    title: 'text not null',
    format: "text not null default 'post' check (format in ('post','article','carousel','other'))",
    stage: "text not null default 'idea' check (stage in ('idea','drafting','published'))",
    body: "text not null default ''",
    published_url: 'text',
    published_at: 'date',
    position: 'int not null default 0',
  },
  content_claims: {
    piece_id: 'uuid not null references content_pieces on delete cascade',
    claim: 'text not null',
    number: 'text',
    source_url: 'text',
    source_date: 'date',
  },
  habits: {
    board_id: 'uuid not null references boards on delete cascade',
    name: 'text not null',
    archived: 'boolean not null default false',
    position: 'int not null default 0',
  },
  habit_logs: {
    habit_id: 'uuid not null references habits on delete cascade',
    day: 'date not null',
  },
} as const;

export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];

const JSON_COLS = new Set(['scores']);
export const isJsonCol = (col: string) => JSON_COLS.has(col);

export function ddl(): string[] {
  const out: string[] = [
    `create table if not exists _meta (key text primary key, value text not null)`,
  ];
  for (const t of TABLE_NAMES) {
    const cols = Object.entries(TABLES[t]).map(([c, def]) => `${c} ${def}`);
    out.push(
      `create table if not exists ${t} (
        id uuid primary key default gen_random_uuid(),
        ${cols.join(',\n        ')},
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`,
    );
  }
  out.push(
    `create unique index if not exists habit_logs_unique on habit_logs (habit_id, day)`,
    `create index if not exists todos_board on todos (board_id)`,
    `create index if not exists todos_due on todos (due_date) where status <> 'done'`,
    `create index if not exists notes_board on notes (board_id)`,
    `create index if not exists files_board on files (board_id)`,
  );
  return out;
}

/** One query returning every table as JSON — the app's whole dataset in one round trip. */
export function snapshotSql(): string {
  const parts = TABLE_NAMES.map(
    (t) => `'${t}', coalesce((select json_agg(x order by x.created_at) from ${t} x), '[]'::json)`,
  );
  return `select json_build_object(${parts.join(', ')}) as data`;
}

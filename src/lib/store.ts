// Local-first store: the whole dataset lives in memory + IndexedDB.
// Writes apply instantly, then go to the server in batched, coalesced requests.
// Reads never hit the network after the one snapshot load — very few requests.
import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { emptyDB, TABLES, type DB, type Row, type Table } from './types';
import { api, ApiError } from './api';

type Op =
  | { op: 'insert'; table: Table; row: Record<string, unknown> }
  | { op: 'update'; table: Table; id: string; patch: Record<string, unknown> }
  | { op: 'delete'; table: Table; id: string };

const DEFAULTS: { [T in Table]: Partial<Row<T>> } = {
  boards: { kind: 'standard', role: null, color: '#6366f1', icon: 'folder', position: 0, archived: false },
  notes: { board_id: null, person_id: null, title: '', content: '', pinned: false },
  checklists: { position: 0 },
  checklist_items: { done: false, position: 0 },
  goals: { description: '', deadline: null },
  todos: { board_id: null, parent_id: null, goal_id: null, details: '', due_date: null, priority: 2, status: 'todo', recurrence: 'none', top3: null, position: 0, completed_at: null },
  files: { todo_id: null, kind: 'file', storage_path: null, url: null, mime: null, size: null, tags: [] },
  courses: { code: null, target: 80, position: 0 },
  grade_components: { item_count: 1, best_of: null, scores: [], position: 0 },
  assessments: { course_id: null, type: 'quiz', due_at: null, done: false },
  content_pieces: { format: 'post', stage: 'idea', body: '', published_url: null, published_at: null, position: 0 },
  content_claims: { number: null, source_url: null, source_date: null },
  people: { relation: null, birth_month: null, birth_day: null, birth_year: null },
  habits: { archived: false, position: 0 },
  habit_logs: {},
};

// child table -> [foreign key, parent table, on delete]
const RELATIONS: [Table, string, Table, 'cascade' | 'null'][] = [
  ['notes', 'board_id', 'boards', 'cascade'], ['checklists', 'board_id', 'boards', 'cascade'],
  ['goals', 'board_id', 'boards', 'cascade'], ['todos', 'board_id', 'boards', 'cascade'],
  ['files', 'board_id', 'boards', 'cascade'], ['courses', 'board_id', 'boards', 'cascade'],
  ['assessments', 'board_id', 'boards', 'cascade'], ['content_pieces', 'board_id', 'boards', 'cascade'],
  ['people', 'board_id', 'boards', 'cascade'], ['habits', 'board_id', 'boards', 'cascade'],
  ['checklist_items', 'checklist_id', 'checklists', 'cascade'], ['todos', 'parent_id', 'todos', 'cascade'],
  ['todos', 'goal_id', 'goals', 'null'], ['files', 'todo_id', 'todos', 'null'],
  ['grade_components', 'course_id', 'courses', 'cascade'], ['assessments', 'course_id', 'courses', 'cascade'],
  ['content_claims', 'piece_id', 'content_pieces', 'cascade'], ['notes', 'person_id', 'people', 'cascade'],
  ['habit_logs', 'habit_id', 'habits', 'cascade'],
];

// parents before children, matching the server's foreign keys
const RESTORE_ORDER: Table[] = ['boards', 'people', 'notes', 'checklists', 'checklist_items', 'goals', 'todos', 'files', 'courses', 'grade_components', 'assessments', 'content_pieces', 'content_claims', 'habits', 'habit_logs'];

function applyOp(db: DB, op: Op): DB {
  const next = { ...db } as Record<Table, any[]>;
  if (op.op === 'insert') {
    if (!next[op.table].some((r) => r.id === op.row.id)) next[op.table] = [...next[op.table], op.row];
  } else if (op.op === 'update') {
    next[op.table] = next[op.table].map((r) => (r.id === op.id ? { ...r, ...op.patch, updated_at: new Date().toISOString() } : r));
  } else {
    // delete + local cascade (the server does the same with foreign keys)
    const doomed: [Table, string][] = [[op.table, op.id]];
    while (doomed.length) {
      const [t, id] = doomed.pop()!;
      next[t] = next[t].filter((r) => r.id !== id);
      for (const [child, fk, parent, mode] of RELATIONS) {
        if (parent !== t) continue;
        if (mode === 'cascade') {
          for (const r of next[child]) if (r[fk] === id) doomed.push([child, r.id]);
        } else {
          next[child] = next[child].map((r) => (r[fk] === id ? { ...r, [fk]: null } : r));
        }
      }
    }
  }
  return next as unknown as DB;
}

/** Merge a new op into the queue so a burst of edits becomes one write. */
function enqueue(queue: Op[], op: Op): Op[] {
  if (op.op === 'update') {
    const i = queue.findIndex((q) => q.table === op.table && (q.op === 'insert' ? q.row.id === op.id : q.op === 'update' && q.id === op.id));
    if (i >= 0) {
      const q = queue[i];
      const merged: Op = q.op === 'insert' ? { ...q, row: { ...q.row, ...op.patch } } : { ...(q as Extract<Op, { op: 'update' }>), patch: { ...(q as any).patch, ...op.patch } };
      return [...queue.slice(0, i), merged, ...queue.slice(i + 1)];
    }
  }
  if (op.op === 'delete') {
    const hadInsert = queue.some((q) => q.op === 'insert' && q.table === op.table && q.row.id === op.id);
    const rest = queue.filter((q) => !(q.table === op.table && (q.op === 'insert' ? q.row.id === op.id : q.id === op.id)));
    return hadInsert ? rest : [...rest, op];
  }
  return [...queue, op];
}

interface State {
  db: DB;
  loaded: boolean;
  authed: boolean | null;
  storage: 'blob' | 'local';
  queue: Op[];
  syncing: boolean;
  error: string | null;
  lastSync: number;
  insert<T extends Table>(table: T, row: Partial<Row<T>>): Row<T>;
  update<T extends Table>(table: T, id: string, patch: Partial<Row<T>>): void;
  /** Deletes (with local cascade) and returns an undo function. */
  remove(table: Table, id: string): () => void;
  sync(force?: boolean): Promise<void>;
  flush(): Promise<void>;
  boot(): Promise<void>;
  setAuthed(v: boolean): void;
}

let flushTimer: ReturnType<typeof setTimeout> | undefined;
let persistTimer: ReturnType<typeof setTimeout> | undefined;
let flushing: Promise<void> | null = null;

export const uid = () => crypto.randomUUID();

export const useStore = create<State>((set, get) => {
  const persist = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const { db, queue } = get();
      idbSet('lifeos-cache', { db, queue }).catch(() => {});
    }, 300);
  };
  const push = (op: Op) => {
    set((s) => ({ db: applyOp(s.db, op), queue: enqueue(s.queue, op) }));
    persist();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => get().flush(), 800);
  };

  return {
    db: emptyDB(),
    loaded: false,
    authed: null,
    storage: 'local',
    queue: [],
    syncing: false,
    error: null,
    lastSync: 0,

    insert(table, row) {
      const now = new Date().toISOString();
      const full = { ...DEFAULTS[table], ...row, id: (row as any).id ?? uid(), created_at: now, updated_at: now } as Row<typeof table>;
      push({ op: 'insert', table, row: full as unknown as Record<string, unknown> }); // server ignores timestamps
      return full;
    },
    update(table, id, patch) {
      push({ op: 'update', table, id, patch: patch as Record<string, unknown> });
    },
    remove(table, id) {
      const before = get().db;
      push({ op: 'delete', table, id });
      const after = get().db;
      // Work out exactly what the delete took with it, so it can be undone.
      const removed: [Table, any][] = [];
      const nulled: [Table, string, Record<string, unknown>][] = [];
      for (const t of RESTORE_ORDER) {
        const keep = new Map((after[t] as any[]).map((r) => [r.id, r]));
        for (const r of before[t] as any[]) {
          const now = keep.get(r.id);
          if (!now) removed.push([t, r]);
          else if (now !== r) nulled.push([t, r.id, Object.fromEntries(Object.keys(r).filter((k) => k.endsWith('_id') && r[k] !== now[k]).map((k) => [k, r[k]]))]);
        }
      }
      removed.sort((a, b) => RESTORE_ORDER.indexOf(a[0]) - RESTORE_ORDER.indexOf(b[0]) || Number(!!a[1].parent_id) - Number(!!b[1].parent_id));
      return () => {
        for (const [t, r] of removed) push({ op: 'insert', table: t, row: r });
        for (const [t, rid, patch] of nulled) if (Object.keys(patch).length) push({ op: 'update', table: t, id: rid, patch });
      };
    },

    async flush() {
      if (flushing) return flushing;
      flushing = (async () => {
        while (get().queue.length) {
          const batch = get().queue.slice(0, 200);
          try {
            await api.mutate(batch);
            set((s) => ({ queue: s.queue.slice(batch.length), error: null }));
            persist();
          } catch (e) {
            if (e instanceof ApiError && e.status === 401) set({ authed: false });
            else set({ error: navigator.onLine ? `Save failed: ${(e as Error).message}` : 'Offline. Changes are saved on this device.' });
            clearTimeout(flushTimer);
            flushTimer = setTimeout(() => get().flush(), 15000);
            return;
          }
        }
      })().finally(() => (flushing = null));
      return flushing;
    },

    async sync(force = false) {
      const s = get();
      if (s.syncing || (!force && Date.now() - s.lastSync < 120_000)) return;
      set({ syncing: true });
      try {
        await get().flush();
        if (get().queue.length) return; // couldn't save; keep local state
        const data = await api.snapshot();
        let db = emptyDB();
        for (const t of TABLES) (db as any)[t] = (data as any)[t] ?? [];
        for (const op of get().queue) db = applyOp(db, op); // edits made during fetch
        set({ db, loaded: true, lastSync: Date.now(), error: null });
        persist();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) set({ authed: false });
        else set({ error: 'Could not reach server. Showing saved data.' });
      } finally {
        set({ syncing: false });
      }
    },

    async boot() {
      const cached = await idbGet('lifeos-cache').catch(() => null);
      if (cached?.db) set({ db: { ...emptyDB(), ...cached.db }, queue: cached.queue ?? [], loaded: true });
      try {
        const sess = await api.session();
        set({ authed: sess.authed, storage: sess.storage });
        if (sess.authed) await get().sync(true);
      } catch {
        // offline: trust the cache if we have one
        set({ authed: cached?.db ? true : false, error: 'Offline. Showing saved data.' });
      }
    },

    setAuthed(v) {
      set({ authed: v });
    },
  };
});

// Refresh on refocus (rate-limited to once per 2 minutes inside sync()).
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const s = useStore.getState();
    if (document.visibilityState === 'visible' && s.authed) s.sync();
    if (document.visibilityState === 'hidden') s.flush();
  });
  window.addEventListener('online', () => useStore.getState().flush());
}

import type { DB } from './types';
import { stripHtml } from './utils';

export interface SearchResults {
  todos: DB['todos']; notes: DB['notes']; checklists: DB['checklists']; files: DB['files'];
  pieces: DB['content_pieces']; people: DB['people'];
}

/** Case-insensitive search across everything. Null when the query is too short. */
export function searchAll(db: DB, q: string, limit = 30): SearchResults | null {
  const ql = q.trim().toLowerCase();
  if (ql.length < 2) return null;
  const has = (...xs: (string | null | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(ql));
  return {
    todos: db.todos.filter((t) => has(t.title, t.details)).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')).slice(0, limit),
    notes: db.notes.filter((n) => has(n.title, stripHtml(n.content))).slice(0, limit),
    checklists: db.checklists.filter((c) => has(c.title) || db.checklist_items.some((i) => i.checklist_id === c.id && has(i.text))).slice(0, limit),
    files: db.files.filter((f) => has(f.name, f.url, ...f.tags)).slice(0, limit),
    pieces: db.content_pieces.filter((p) => has(p.title, stripHtml(p.body))).slice(0, limit),
    people: db.people.filter((p) => has(p.name, p.relation)).slice(0, limit),
  };
}

export const countResults = (r: SearchResults | null) => (r ? Object.values(r).reduce((n, l) => n + l.length, 0) : 0);

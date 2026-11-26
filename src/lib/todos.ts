import { format, parseISO } from 'date-fns';
import { useStore } from './store';
import { haptic, toast } from './toast';
import type { Todo } from './types';
import { nextDue, todayISO } from './utils';

/** Toggle done. Completing a recurring to-do schedules the next one (with fresh subtasks). */
export function toggleTodo(t: Todo) {
  const s = useStore.getState();
  if (t.status === 'done') {
    s.update('todos', t.id, { status: 'todo', completed_at: null });
    return;
  }
  haptic();
  s.update('todos', t.id, { status: 'done', completed_at: new Date().toISOString(), top3: null });
  if (t.recurrence !== 'none' && !t.parent_id) {
    const next = s.insert('todos', {
      board_id: t.board_id, goal_id: t.goal_id, title: t.title, details: t.details, priority: t.priority,
      recurrence: t.recurrence, due_date: nextDue(t.due_date ?? todayISO(), t.recurrence), position: t.position,
    });
    for (const sub of s.db.todos.filter((x) => x.parent_id === t.id)) {
      s.insert('todos', { board_id: t.board_id, parent_id: next.id, title: sub.title, priority: sub.priority, position: sub.position });
    }
    toast(`Repeats · next one ${format(parseISO(next.due_date!), 'EEE d MMM')}`);
  }
}

export function sortTodos(a: Todo, b: Todo) {
  const done = Number(a.status === 'done') - Number(b.status === 'done');
  if (done) return done;
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return a.priority - b.priority || a.position - b.position;
}

/** Pin to Today's Top 3 (first free slot). Returns false if all 3 are taken. */
export function toggleTop3(t: Todo): boolean {
  const s = useStore.getState();
  if (t.top3) { s.update('todos', t.id, { top3: null }); return true; }
  const used = new Set(s.db.todos.filter((x) => x.top3 && x.status !== 'done').map((x) => x.top3));
  const slot = [1, 2, 3].find((n) => !used.has(n));
  if (!slot) return false;
  s.update('todos', t.id, { top3: slot });
  return true;
}

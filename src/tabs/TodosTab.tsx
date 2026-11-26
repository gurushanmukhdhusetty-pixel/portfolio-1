import { useMemo, useState } from 'react';
import { CalendarPlus, ChevronDown, ListChecks, Plus } from 'lucide-react';
import { useStore } from '../lib/store';
import { sortTodos, toggleTodo } from '../lib/todos';
import type { Board, Status, Todo } from '../lib/types';
import { cx, maxPos, todayISO } from '../lib/utils';
import { TodoItem } from '../components/TodoItem';
import { TodoEditor } from '../components/TodoEditor';
import { Kanban } from '../components/Kanban';
import { DueChip, Empty, PriorityFlag, Segmented } from '../components/ui';

function usePersisted<T extends string>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { return (localStorage.getItem(key) as T) || init; } catch { return init; } });
  return [v, (n) => { setV(n); try { localStorage.setItem(key, n); } catch { /* ignore */ } }];
}

export function QuickAdd({ boardId, goalId, placeholder = 'Add a to-do…' }: { boardId: string | null; goalId?: string; placeholder?: string }) {
  const insert = useStore((s) => s.insert);
  const todos = useStore((s) => s.db.todos);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [p, setP] = useState<1 | 2 | 3>(2);
  const add = () => {
    if (!title.trim()) return;
    insert('todos', { board_id: boardId, goal_id: goalId ?? null, title: title.trim(), due_date: due || null, priority: p, position: maxPos(todos.filter((t) => t.board_id === boardId)) });
    setTitle('');
  };
  return (
    <div className="card mb-3 flex items-center gap-2 py-1 pr-1.5 pl-3 focus-within:border-[var(--accent)]">
      <Plus size={18} className="shrink-0 text-[var(--accent)]" />
      <input className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-faint" placeholder={placeholder} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
      <label className={cx('relative flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-xs', due ? 'text-ink' : 'text-faint hover:text-ink')}>
        {due ? <DueChip due={due} /> : <CalendarPlus size={17} />}
        <input type="date" className="absolute inset-0 cursor-pointer opacity-0" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
      </label>
      <button className="rounded-lg p-1.5 hover:bg-panel2" onClick={() => setP(((p % 3) + 1) as 1 | 2 | 3)} title={`Priority P${p} (tap to change)`}><PriorityFlag p={p} /></button>
      {title && <button className="btn-primary px-2.5 py-1.5" onClick={add}>Add</button>}
    </div>
  );
}

export function TodoGroups({ todos, onOpen, showBoard }: { todos: Todo[]; onOpen: (t: Todo) => void; showBoard?: boolean }) {
  const [showDone, setShowDone] = useState(false);
  const today = todayISO();
  const open = todos.filter((t) => t.status !== 'done').sort(sortTodos);
  const done = todos.filter((t) => t.status === 'done').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  const groups: [string, Todo[]][] = [
    ['Overdue', open.filter((t) => t.due_date && t.due_date < today)],
    ['Today', open.filter((t) => t.due_date === today)],
    ['Upcoming', open.filter((t) => t.due_date && t.due_date > today)],
    ['No date', open.filter((t) => !t.due_date)],
  ];
  return (
    <div className="space-y-4">
      {groups.filter(([, l]) => l.length).map(([label, list]) => (
        <div key={label}>
          <div className={cx('mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider', label === 'Overdue' ? 'text-red-500' : 'text-mute')}>{label} <span className="font-normal text-faint">{list.length}</span></div>
          <div className="card divide-y divide-line overflow-hidden">{list.map((t) => <TodoItem key={t.id} todo={t} onOpen={onOpen} showBoard={showBoard} />)}</div>
        </div>
      ))}
      {done.length > 0 && (
        <div>
          <button className="mb-1.5 flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wider text-mute" onClick={() => setShowDone(!showDone)}>
            <ChevronDown size={14} className={cx('transition', !showDone && '-rotate-90')} /> Done <span className="font-normal text-faint">{done.length}</span>
          </button>
          {showDone && <div className="card divide-y divide-line overflow-hidden">{done.slice(0, 50).map((t) => <TodoItem key={t.id} todo={t} onOpen={onOpen} showBoard={showBoard} />)}</div>}
        </div>
      )}
    </div>
  );
}

const COLS = [
  { key: 'todo' as Status, label: 'To do', color: '#94a3b8' },
  { key: 'doing' as Status, label: 'Doing', color: '#38bdf8' },
  { key: 'done' as Status, label: 'Done', color: '#22c55e' },
];

export default function TodosTab({ board }: { board: Board }) {
  const all = useStore((s) => s.db.todos);
  const update = useStore((s) => s.update);
  const todos = useMemo(() => all.filter((t) => t.board_id === board.id && !t.parent_id), [all, board.id]);
  const [view, setView] = usePersisted<'list' | 'board'>('todos-view', 'list');
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex-1 text-sm text-mute">{todos.filter((t) => t.status !== 'done').length} open</div>
        <Segmented value={view} onChange={setView} size="sm" options={[{ value: 'list', label: 'List' }, { value: 'board', label: 'Kanban' }]} />
      </div>
      <QuickAdd boardId={board.id} />
      {todos.length === 0 ? (
        <Empty icon={<ListChecks size={22} />} title="Nothing to do yet" hint="Add your first to-do above. Set a date and it shows up in Today and Week." />
      ) : view === 'list' ? (
        <TodoGroups todos={todos} onOpen={(t) => setOpen(t.id)} />
      ) : (
        <Kanban columns={COLS} items={[...todos].sort(sortTodos).filter((t) => t.status !== 'done' || (t.completed_at ?? '') > new Date(Date.now() - 14 * 864e5).toISOString())}
          getCol={(t) => t.status}
          onMove={(t, to) => (to === 'done' ? toggleTodo(t) : update('todos', t.id, { status: to, completed_at: null }))}
          renderCard={(t) => (
            <button onClick={() => setOpen(t.id)} className="card block w-full p-3 text-left text-sm shadow-sm transition hover:shadow-md">
              <div className={cx('mb-1.5', t.status === 'done' && 'text-faint line-through')}>{t.title}</div>
              <div className="flex items-center gap-2"><PriorityFlag p={t.priority} /><DueChip due={t.status === 'done' ? null : t.due_date} /></div>
            </button>
          )} />
      )}
      <TodoEditor id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

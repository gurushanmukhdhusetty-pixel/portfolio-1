import { useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ChevronDown, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { removeWithUndo } from '../lib/toast';
import { sortTodos } from '../lib/todos';
import type { Board, Goal } from '../lib/types';
import { cx } from '../lib/utils';
import { TodoItem } from '../components/TodoItem';
import { TodoEditor } from '../components/TodoEditor';
import { QuickAdd } from './TodosTab';
import { Empty, Field, Sheet } from '../components/ui';

export function goalProgress(goalId: string, todos: { goal_id: string | null; status: string; parent_id: string | null }[]) {
  const linked = todos.filter((t) => t.goal_id === goalId && !t.parent_id);
  const done = linked.filter((t) => t.status === 'done').length;
  return { done, total: linked.length, pct: linked.length ? (done / linked.length) * 100 : 0 };
}

function GoalEditor({ goal, board, onClose }: { goal: Goal | null; board: Board; onClose: () => void }) {
  const s = useStore();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [desc, setDesc] = useState(goal?.description ?? '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const save = () => {
    if (!title.trim()) return;
    const row = { title: title.trim(), description: desc, deadline: deadline || null };
    if (goal) s.update('goals', goal.id, row); else s.insert('goals', { ...row, board_id: board.id });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={goal ? 'Edit goal' : 'New goal'}
      footer={<div className="flex gap-2">
        {goal && <button className="btn-ghost text-red-500" onClick={() => { removeWithUndo('goals', goal.id, 'Goal deleted'); onClose(); }}><Trash2 size={16} /> Delete</button>}
        <div className="flex-1" /><button className="btn-primary" onClick={save}>Save</button>
      </div>}>
      <div className="space-y-3">
        <Field label="Goal"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Score 85%+ in Strategic Management" autoFocus={!goal} /></Field>
        <Field label="Why it matters (optional)"><textarea className="input min-h-20" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label="Deadline"><input type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        <p className="text-xs text-mute">Progress is calculated from the to-dos you link to this goal.</p>
      </div>
    </Sheet>
  );
}

function GoalCard({ goal, board }: { goal: Goal; board: Board }) {
  const todos = useStore((s) => s.db.todos);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [todo, setTodo] = useState<string | null>(null);
  const p = goalProgress(goal.id, todos);
  const linked = todos.filter((t) => t.goal_id === goal.id && !t.parent_id).sort(sortTodos);
  const days = goal.deadline ? differenceInCalendarDays(parseISO(goal.deadline), new Date()) : null;
  const r = 20, c = 2 * Math.PI * r;
  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-center gap-3.5 p-4 text-left" onClick={() => setOpen(!open)}>
        <div className="relative grid shrink-0 place-items-center">
          <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
            <circle cx="26" cy="26" r={r} fill="none" stroke="var(--panel2)" strokeWidth="5" />
            <circle cx="26" cy="26" r={r} fill="none" stroke={board.color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p.pct / 100)} className="transition-all duration-700" />
          </svg>
          <span className="absolute text-[11px] font-semibold tabular-nums">{Math.round(p.pct)}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{goal.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-mute">
            <span>{p.total ? `${p.done}/${p.total} to-dos` : 'No linked to-dos yet'}</span>
            {goal.deadline && <span className={cx(days! < 0 && p.pct < 100 && 'text-red-500', days! >= 0 && days! <= 7 && 'text-amber-500')}>
              {days! < 0 ? `${-days!}d past deadline` : days === 0 ? 'Due today' : `${days}d left · ${format(parseISO(goal.deadline), 'd MMM')}`}
            </span>}
          </div>
        </div>
        <ChevronDown size={18} className={cx('text-faint transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line p-3">
          {goal.description && <p className="mb-3 px-1 text-sm text-mute">{goal.description}</p>}
          <QuickAdd boardId={board.id} goalId={goal.id} placeholder="Add a step toward this goal…" />
          {linked.length > 0 && <div className="card divide-y divide-line overflow-hidden">{linked.map((t) => <TodoItem key={t.id} todo={t} onOpen={(x) => setTodo(x.id)} />)}</div>}
          <div className="mt-2 flex justify-end"><button className="btn-ghost text-xs" onClick={() => setEdit(true)}><Pencil size={13} /> Edit goal</button></div>
        </div>
      )}
      {edit && <GoalEditor goal={goal} board={board} onClose={() => setEdit(false)} />}
      <TodoEditor id={todo} onClose={() => setTodo(null)} />
    </div>
  );
}

export default function GoalsTab({ board }: { board: Board }) {
  const goals = useStore((s) => s.db.goals).filter((g) => g.board_id === board.id).sort((a, b) => (a.deadline ?? '9').localeCompare(b.deadline ?? '9'));
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="mb-3 flex items-center">
        <div className="flex-1 text-sm text-mute">{goals.length} {goals.length === 1 ? 'goal' : 'goals'}</div>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Goal</button>
      </div>
      {goals.length ? <div className="space-y-3">{goals.map((g) => <GoalCard key={g.id} goal={g} board={board} />)}</div>
        : <Empty icon={<Target size={22} />} title="No goals yet" hint="Set a goal with a deadline, then add the to-dos that get you there. Progress fills in as you tick them off." />}
      {adding && <GoalEditor goal={null} board={board} onClose={() => setAdding(false)} />}
    </div>
  );
}

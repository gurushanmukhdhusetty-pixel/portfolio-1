import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, formatDistanceToNowStrict } from 'date-fns';
import { Cake, CalendarClock, PartyPopper, Plus, Star, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { sortTodos, toggleTodo, toggleTop3 } from '../lib/todos';
import { nextBirthday, todayISO, cx } from '../lib/utils';
import type { Todo } from '../lib/types';
import { TodoItem } from '../components/TodoItem';
import { TodoEditor } from '../components/TodoEditor';
import { CheckBox, DueChip, Section, Sheet, SearchInput } from '../components/ui';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Ring({ value }: { value: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--panel2)" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="transition-all duration-700" />
    </svg>
  );
}

function Top3Picker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const todos = useStore((s) => s.db.todos);
  const boards = useStore((s) => s.db.boards);
  const [q, setQ] = useState('');
  const list = todos.filter((t) => !t.parent_id && t.status !== 'done' && !t.top3 && t.title.toLowerCase().includes(q.toLowerCase())).sort(sortTodos).slice(0, 40);
  return (
    <Sheet open={open} onClose={onClose} title="Pin to Top 3">
      <div className="mb-3"><SearchInput value={q} onChange={setQ} placeholder="Find a to-do" autoFocus /></div>
      <div className="card divide-y divide-line overflow-hidden">
        {list.map((t) => {
          const b = boards.find((x) => x.id === t.board_id);
          return (
            <button key={t.id} className="row w-full text-left" onClick={() => { toggleTop3(t); onClose(); }}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b?.color ?? 'var(--faint)' }} />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <DueChip due={t.due_date} />
            </button>
          );
        })}
        {!list.length && <div className="p-4 text-center text-sm text-mute">No open to-dos to pin.</div>}
      </div>
    </Sheet>
  );
}

export default function Today() {
  const { todos, boards, assessments, people, courses } = useStore((s) => s.db);
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const today = todayISO();

  const live = useMemo(() => new Set(boards.filter((b) => !b.archived).map((b) => b.id)), [boards]);
  const visible = (t: Todo) => !t.board_id || live.has(t.board_id);
  const top = todos.filter((t) => t.top3 && t.status !== 'done' && visible(t)).sort((a, b) => a.top3! - b.top3!);
  const due = todos.filter((t) => !t.parent_id && t.status !== 'done' && t.due_date && t.due_date <= today && visible(t)).sort(sortTodos);
  const overdue = due.filter((t) => t.due_date! < today);
  const dueToday = due.filter((t) => t.due_date === today);
  const doneToday = todos.filter((t) => !t.parent_id && t.status === 'done' && t.completed_at && format(parseISO(t.completed_at), 'yyyy-MM-dd') === today);
  const progress = doneToday.length + due.length ? doneToday.length / (doneToday.length + due.length) : 0;

  const nextAssessment = assessments.filter((a) => !a.done && a.due_at && parseISO(a.due_at) > new Date()).sort((a, b) => a.due_at!.localeCompare(b.due_at!))[0];
  const assessToday = assessments.filter((a) => !a.done && a.due_at && format(parseISO(a.due_at), 'yyyy-MM-dd') === today);
  const bdays = people.map((p) => ({ p, nb: nextBirthday(p) })).filter((x) => x.nb && x.nb.days <= 7).sort((a, b) => a.nb!.days - b.nb!.days);
  const academics = boards.find((b) => b.kind === 'academics');

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-mute">{format(new Date(), 'EEEE, d MMMM')}</div>
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight sm:text-[26px]">{greeting()}, Shanmukh</h1>
          <div className="mt-0.5 text-sm text-mute">
            {due.length === 0 ? 'Nothing due. Clear runway.' : `${dueToday.length} due today${overdue.length ? ` · ${overdue.length} overdue` : ''}`}
          </div>
        </div>
        <div className="relative grid place-items-center" title={`${doneToday.length} done today`}>
          <Ring value={progress} />
          <span className="absolute text-xs font-semibold">{doneToday.length}/{doneToday.length + due.length}</span>
        </div>
      </div>

      <Section title={<span className="flex items-center gap-1.5"><Star size={12} className="text-amber-400" fill="currentColor" /> Top 3</span>}>
        <div className="grid gap-2 sm:grid-cols-3">
          {[1, 2, 3].map((slot) => {
            const t = top.find((x) => x.top3 === slot);
            const b = t && boards.find((x) => x.id === t.board_id);
            if (!t) return (
              <button key={slot} onClick={() => setPicking(true)} className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-3.5 text-sm text-faint transition hover:border-[var(--accent)] hover:text-ink">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-panel2 text-xs font-semibold">{slot}</span>
                <span className="flex-1 text-left">Pin a priority</span><Plus size={16} />
              </button>
            );
            return (
              <div key={slot} onClick={() => setOpen(t.id)} className="card group relative flex cursor-pointer items-center gap-3 overflow-hidden p-3.5 transition hover:shadow-md">
                <div className="absolute inset-y-0 left-0 w-1" style={{ background: b?.color ?? 'var(--accent)' }} />
                <CheckBox checked={false} onChange={() => toggleTodo(t)} color={b?.color} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.title}</div>
                  <div className="text-[11px] text-mute">{b?.name ?? 'Inbox'}</div>
                </div>
                <button className="text-faint opacity-60 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); toggleTop3(t); }} aria-label="Unpin"><X size={15} /></button>
              </div>
            );
          })}
        </div>
      </Section>

      {(nextAssessment || bdays.length > 0 || assessToday.length > 0) && (
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0">
          {nextAssessment && (
            <Link to={academics ? `/b/${academics.id}?tab=assessments` : '/'} className="card flex shrink-0 items-center gap-3 px-3.5 py-2.5 transition hover:shadow-md">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/15 text-blue-500"><CalendarClock size={18} /></div>
              <div>
                <div className="text-sm font-medium">{nextAssessment.title}</div>
                <div className="text-[11px] text-mute">
                  {courses.find((c) => c.id === nextAssessment.course_id)?.name ?? 'Next assessment'} · in {formatDistanceToNowStrict(parseISO(nextAssessment.due_at!))}
                </div>
              </div>
            </Link>
          )}
          {bdays.map(({ p, nb }) => (
            <div key={p.id} className={cx('card flex shrink-0 items-center gap-3 px-3.5 py-2.5', nb!.days === 0 && 'border-pink-500/50')}>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-pink-500/15 text-pink-500">{nb!.days === 0 ? <PartyPopper size={18} /> : <Cake size={18} />}</div>
              <div>
                <div className="text-sm font-medium">{p.name}{nb!.turning ? ` turns ${nb!.turning}` : ''}</div>
                <div className="text-[11px] text-mute">{nb!.days === 0 ? 'Birthday today 🎉' : nb!.days === 1 ? 'Tomorrow' : `In ${nb!.days} days · ${format(nb!.date, 'EEE d MMM')}`}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {overdue.length > 0 && (
        <Section title={<span className="text-red-500">Overdue · {overdue.length}</span>}>
          <div className="card divide-y divide-line overflow-hidden">{overdue.map((t) => <TodoItem key={t.id} todo={t} onOpen={(x) => setOpen(x.id)} showBoard />)}</div>
        </Section>
      )}
      <Section title={`Due today · ${dueToday.length}`}>
        {dueToday.length ? (
          <div className="card divide-y divide-line overflow-hidden">{dueToday.map((t) => <TodoItem key={t.id} todo={t} onOpen={(x) => setOpen(x.id)} showBoard />)}</div>
        ) : (
          <div className="card px-4 py-6 text-center text-sm text-mute">Nothing due today. Tap <span className="font-semibold text-ink">+</span> to capture something.</div>
        )}
      </Section>
      {doneToday.length > 0 && (
        <Section title={`Done today · ${doneToday.length}`}>
          <div className="card divide-y divide-line overflow-hidden opacity-80">{doneToday.map((t) => <TodoItem key={t.id} todo={t} onOpen={(x) => setOpen(x.id)} showBoard />)}</div>
        </Section>
      )}

      <Top3Picker open={picking} onClose={() => setPicking(false)} />
      <TodoEditor id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

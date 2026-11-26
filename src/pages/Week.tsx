import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, format, isToday, isTomorrow, parseISO } from 'date-fns';
import { Cake, CalendarClock, ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { useStore } from '../lib/store';
import { sortTodos } from '../lib/todos';
import { nextBirthday, todayISO, toISO, cx } from '../lib/utils';
import { TodoItem } from '../components/TodoItem';
import { PageHeader } from '../components/ui';
import { TodoEditor } from '../components/TodoEditor';

export default function Week() {
  const { todos, boards, assessments, goals, people, courses } = useStore((s) => s.db);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const today = todayISO();
  const live = useMemo(() => new Set(boards.filter((b) => !b.archived).map((b) => b.id)), [boards]);
  const start = addDays(new Date(), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const openTodos = todos.filter((t) => !t.parent_id && t.status !== 'done' && t.due_date && (!t.board_id || live.has(t.board_id)));
  const overdue = offset === 0 ? openTodos.filter((t) => t.due_date! < today).sort(sortTodos) : [];
  const boardColor = (id: string | null) => boards.find((b) => b.id === id)?.color ?? 'var(--faint)';

  const dayData = days.map((d) => {
    const iso = toISO(d);
    return {
      d, iso,
      todos: openTodos.filter((t) => t.due_date === iso).sort(sortTodos),
      assess: assessments.filter((a) => !a.done && a.due_at && format(parseISO(a.due_at), 'yyyy-MM-dd') === iso && live.has(a.board_id)),
      goals: goals.filter((g) => g.deadline === iso && live.has(g.board_id)),
      bdays: people.filter((p) => { const nb = nextBirthday(p); return nb && toISO(nb.date) === iso; }),
    };
  });
  const count = (x: (typeof dayData)[number]) => x.todos.length + x.assess.length + x.goals.length + x.bdays.length;
  const total = dayData.reduce((n, x) => n + count(x), 0);
  const maxLoad = Math.max(...dayData.map(count));

  return (
    <div>
      <PageHeader compact="Week" eyebrow={`${format(days[0], 'd MMM')} – ${format(days[6], 'd MMM')}`}
        title={offset === 0 ? 'This week' : offset === 1 ? 'Next week' : `In ${offset} weeks`}
        subtitle={`${total} ${total === 1 ? 'thing' : 'things'} scheduled${overdue.length ? ` · ${overdue.length} overdue` : ''}`}
        right={<div className="mb-1 flex gap-1">
          <button className="btn-soft h-10 w-10 rounded-full p-0" disabled={offset === 0} onClick={() => setOffset(offset - 1)} aria-label="Previous week"><ChevronLeft size={18} /></button>
          <button className="btn-soft h-10 w-10 rounded-full p-0" onClick={() => setOffset(offset + 1)} aria-label="Next week"><ChevronRight size={18} /></button>
        </div>} />

      {/* day strip: height of the bar = how loaded the day is */}
      <div className="rise mb-7 grid grid-cols-7 gap-1.5">
        {dayData.map((x) => {
          const n = count(x);
          const today = isToday(x.d);
          return (
            <a key={x.iso} href={`#d-${x.iso}`} onClick={(e) => { e.preventDefault(); document.getElementById(`d-${x.iso}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className={cx('relative flex flex-col items-center overflow-hidden rounded-[18px] pt-2 pb-2.5 transition active:scale-95', today ? 'text-white' : 'card hover:shadow-md')}
              style={today ? { background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 85%, white), var(--accent))', boxShadow: '0 10px 24px -10px var(--accent)' } : undefined}>
              <span className={cx('text-[10px] font-semibold uppercase tracking-wide', today ? 'text-white/80' : 'text-mute')}>{format(x.d, 'EEEEE')}</span>
              <span className="display text-[24px] leading-tight tnum">{format(x.d, 'd')}</span>
              <span className={cx('mt-1 h-1 w-6 overflow-hidden rounded-full', today ? 'bg-white/25' : 'bg-panel2')}>
                <span className={cx('block h-full rounded-full transition-all duration-700', today ? 'bg-white' : 'bg-[var(--accent)]')} style={{ width: `${Math.min(100, (n / Math.max(4, maxLoad)) * 100)}%` }} />
              </span>
            </a>
          );
        })}
      </div>

      {overdue.length > 0 && (
        <div className="mb-6">
          <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-red-500">Overdue · {overdue.length}</div>
          <div className="card divide-y divide-line overflow-hidden">{overdue.map((t) => <TodoItem key={t.id} todo={t} onOpen={(x) => setOpen(x.id)} showBoard />)}</div>
        </div>
      )}

      <div className="relative space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-line">
        {dayData.map((x) => (
          <div key={x.iso} id={`d-${x.iso}`} className="relative scroll-mt-28 pl-7">
            <span className={cx('absolute top-1.5 left-0 h-[15px] w-[15px] rounded-full border-[3px] border-bg', count(x) ? 'bg-[var(--accent)]' : 'bg-line')} />
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="display text-[22px]">{isToday(x.d) ? 'Today' : isTomorrow(x.d) ? 'Tomorrow' : format(x.d, 'EEEE')}</span>
              <span className="text-xs text-mute">{format(x.d, 'd MMM')}</span>
            </div>
            {count(x) === 0 ? (
              <div className="text-sm text-faint italic">Free. Protect it.</div>
            ) : (
              <div className="card divide-y divide-line overflow-hidden">
                {x.assess.map((a) => (
                  <Link key={a.id} to={`/b/${a.board_id}?tab=assessments`} className="row">
                    <CalendarClock size={18} style={{ color: boardColor(a.board_id) }} />
                    <span className="flex-1 truncate text-[15px]">{a.title}<span className="text-mute"> · {courses.find((c) => c.id === a.course_id)?.name ?? a.type}</span></span>
                    <span className="chip bg-blue-500/15 text-blue-500">{format(parseISO(a.due_at!), 'HH:mm')}</span>
                  </Link>
                ))}
                {x.goals.map((g) => (
                  <Link key={g.id} to={`/b/${g.board_id}?tab=goals`} className="row">
                    <Target size={18} style={{ color: boardColor(g.board_id) }} />
                    <span className="flex-1 truncate text-[15px]">Goal deadline: {g.title}</span>
                  </Link>
                ))}
                {x.bdays.map((p) => (
                  <Link key={p.id} to={`/b/${p.board_id}?tab=people`} className="row">
                    <Cake size={18} className="text-pink-500" />
                    <span className="flex-1 truncate text-[15px]">{p.name}'s birthday</span>
                  </Link>
                ))}
                {x.todos.map((t) => <TodoItem key={t.id} todo={t} onOpen={(y) => setOpen(y.id)} showBoard />)}
              </div>
            )}
          </div>
        ))}
      </div>
      <TodoEditor id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { addDays, format, isToday, parseISO, startOfWeek } from 'date-fns';
import { ChevronDown, Coffee, Pause, Play, RotateCcw, SkipForward, Square, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { elapsedOf, fmtClock, fmtMinutes, useFocus, useNowWhile } from '../lib/focus';
import { removeWithUndo } from '../lib/toast';
import { sortTodos } from '../lib/todos';
import { cx, toISO } from '../lib/utils';
import { DueChip, Empty, PageHeader, SearchInput, Section, Sheet } from '../components/ui';

/** "Strategic Management II" → "SM II", "Digital Marketing" → "DM", short names stay. */
export function shortCourse(name: string) {
  if (name.length <= 10) return name;
  return name.split(/\s+/).filter((w) => !['&', 'and', 'of', 'the'].includes(w.toLowerCase()))
    .map((w) => (/^(\d+|[IVX]+)$/.test(w) ? ` ${w}` : w[0].toUpperCase())).join('').trim();
}

function TaskPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const f = useFocus();
  const [q, setQ] = useState('');
  const [label, setLabel] = useState(f.todoId ? '' : f.label);
  const live = new Set(db.boards.filter((b) => !b.archived).map((b) => b.id));
  const todos = db.todos.filter((t) => !t.parent_id && t.status !== 'done' && (!t.board_id || live.has(t.board_id)) && t.title.toLowerCase().includes(q.toLowerCase())).sort(sortTodos).slice(0, 40);
  const pick = (id: string | null) => {
    const t = db.todos.find((x) => x.id === id);
    const last = t ? db.focus_sessions.filter((s) => s.todo_id === t.id).sort((a, b) => b.started_at.localeCompare(a.started_at))[0] : undefined;
    f.setTarget(t ? { todoId: t.id, boardId: t.board_id, label: t.title, courseId: last?.course_id ?? f.courseId } : { todoId: null, boardId: null, label: label.trim() });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="What are you working on?">
      <div className="mb-3 flex gap-2">
        <input className="input" placeholder="Type a label, e.g. Read case study" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pick(null)} />
        <button className="btn-soft" onClick={() => pick(null)}>Use</button>
      </div>
      <div className="eyebrow mb-2 text-[10px]">Or pick a to-do</div>
      <div className="mb-3"><SearchInput value={q} onChange={setQ} placeholder="Find a to-do" /></div>
      <div className="card divide-y divide-line overflow-hidden">
        {todos.map((t) => {
          const b = db.boards.find((x) => x.id === t.board_id);
          return (
            <button key={t.id} className={cx('row w-full text-left', f.todoId === t.id && 'bg-panel2')} onClick={() => pick(t.id)}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b?.color ?? 'var(--faint)' }} />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <DueChip due={t.due_date} />
            </button>
          );
        })}
        {!todos.length && <div className="p-4 text-center text-sm text-mute">No open to-dos match.</div>}
      </div>
    </Sheet>
  );
}

export default function Focus() {
  const f = useFocus();
  const db = useStore((s) => s.db);
  const [picking, setPicking] = useState(false);
  const now = useNowWhile(f.running);
  const board = db.boards.find((b) => b.id === f.boardId);
  const color = f.phase === 'break' ? '#10b981' : board?.color ?? 'var(--accent)';
  const elapsed = f.phase === 'idle' ? 0 : elapsedOf(f, now);
  const total = f.phase === 'idle' ? f.focusMin * 60 : f.duration;
  const left = total - elapsed;
  const pct = total ? elapsed / total : 0;
  const courses = db.courses.slice().sort((a, b) => a.position - b.position);
  const showCourses = courses.length > 0 && (!board || board.kind === 'academics');

  const stats = useMemo(() => {
    const sessions = db.focus_sessions;
    const today = sessions.filter((s) => isToday(parseISO(s.started_at)));
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const week = sessions.filter((s) => parseISO(s.started_at) >= weekStart);
    const groups = new Map<string, { name: string; color: string; min: number }>();
    for (const s of week) {
      const c = db.courses.find((x) => x.id === s.course_id);
      const b = db.boards.find((x) => x.id === (c?.board_id ?? s.board_id));
      const key = c?.id ?? b?.id ?? 'none';
      const g = groups.get(key) ?? { name: c?.name ?? b?.name ?? 'Unassigned', color: b?.color ?? '#94a3b8', min: 0 };
      g.min += s.minutes;
      groups.set(key, g);
    }
    const days = new Set(sessions.map((s) => toISO(parseISO(s.started_at))));
    let d = new Date(), streak = 0;
    if (!days.has(toISO(d))) d = addDays(d, -1);
    while (days.has(toISO(d))) { streak++; d = addDays(d, -1); }
    return {
      todayMin: today.reduce((n, s) => n + s.minutes, 0), todayCount: today.length,
      weekMin: week.reduce((n, s) => n + s.minutes, 0),
      groups: [...groups.values()].sort((a, b) => b.min - a.min), streak,
      recent: sessions.slice().sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 8),
    };
  }, [db.focus_sessions, db.courses, db.boards]);
  const maxGroup = Math.max(1, ...stats.groups.map((g) => g.min));

  const R = 118, C = 2 * Math.PI * R;
  return (
    <div>
      <PageHeader compact="Focus" title="Focus" eyebrow="Study timer" subtitle={stats.todayMin ? `${fmtMinutes(stats.todayMin)} focused today` : 'One thing at a time.'} />

      <div className="card rise relative mb-7 overflow-hidden px-5 pt-6 pb-6 sm:pt-8">
        <div className="aurora" style={{ ['--c1' as string]: color, ['--c2' as string]: color, opacity: f.running ? 0.32 : 0.16, transition: 'opacity 1s' }} />
        <div className="relative flex flex-col items-center">
          <div className="relative grid place-items-center">
            {f.running && <div className="breathe absolute inset-6 rounded-full" style={{ boxShadow: `0 0 80px 10px color-mix(in srgb, ${color} 35%, transparent)` }} />}
            <svg viewBox="0 0 272 272" className="h-[236px] w-[236px] -rotate-90 sm:h-[272px] sm:w-[272px]">
              <circle cx="136" cy="136" r={R} fill="none" stroke="var(--panel2)" strokeWidth="10" />
              <circle cx="136" cy="136" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, pct))} style={{ transition: 'stroke-dashoffset 1s linear', opacity: pct > 0 ? 1 : 0 }} />
              {Array.from({ length: 60 }).map((_, i) => (
                <line key={i} x1="136" y1={136 - R + 14} x2="136" y2={136 - R + (i % 5 ? 18 : 22)} stroke="var(--line)" strokeWidth={i % 5 ? 1 : 1.6} transform={`rotate(${i * 6} 136 136)`} />
              ))}
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="eyebrow mb-1 flex items-center gap-1.5 text-[10px]">
                {f.phase === 'break' ? <><Coffee size={11} /> Break</> : f.phase === 'focus' ? (f.running ? 'Focusing' : 'Paused') : 'Ready'}
              </span>
              <span className="text-[54px] leading-none font-extralight tracking-[-0.03em] tnum sm:text-[62px]">{fmtClock(left)}</span>
              <span className="mt-2 text-xs text-faint tnum">{f.phase === 'idle' ? `${f.focusMin} min focus · ${f.breakMin} min break` : `of ${fmtClock(total)}`}</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-5">
            <button className="btn-soft h-12 w-12 rounded-full p-0" disabled={f.phase === 'idle'} onClick={() => f.stop()} aria-label={f.phase === 'focus' ? 'Stop and log' : 'Reset'}>
              {f.phase === 'focus' ? <Square size={16} fill="currentColor" /> : <RotateCcw size={17} />}
            </button>
            <button aria-label={f.running ? 'Pause' : 'Start'}
              onClick={() => (f.phase === 'idle' ? f.start() : f.running ? f.pause() : f.resume())}
              className="grid h-[76px] w-[76px] place-items-center rounded-full text-white transition active:scale-90"
              style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${color} 80%, white), ${color})`, boxShadow: `0 16px 36px -12px ${color}, inset 0 1px 0 rgb(255 255 255 / 0.35)` }}>
              {f.running ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
            </button>
            <button className="btn-soft h-12 w-12 rounded-full p-0" disabled={f.phase !== 'break'} onClick={() => f.skip()} aria-label="Skip break">
              <SkipForward size={17} />
            </button>
          </div>

          <button onClick={() => setPicking(true)} className="mt-6 flex max-w-full items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-sm transition hover:border-[var(--accent)]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: board?.color ?? 'var(--faint)' }} />
            <span className="truncate">{f.label || 'What are you working on?'}</span>
            <ChevronDown size={14} className="shrink-0 text-faint" />
          </button>

          {showCourses && (
            <div className="-mx-5 mt-3 flex max-w-[calc(100%+40px)] gap-1.5 overflow-x-auto px-5 scrollbar-none">
              {courses.map((c) => (
                <button key={c.id} title={c.name} onClick={() => f.setTarget({ courseId: f.courseId === c.id ? null : c.id })}
                  className={cx('chip shrink-0 px-3 py-1.5 text-xs transition', f.courseId === c.id ? 'bg-ink text-bg' : 'bg-panel2 text-mute hover:text-ink')}>
                  {shortCourse(c.name)}
                </button>
              ))}
            </div>
          )}

          {f.phase === 'idle' && (
            <div className="mt-4 flex gap-1.5">
              {[[25, 5], [50, 10], [90, 15]].map(([a, b]) => (
                <button key={a} onClick={() => f.setPrefs({ focusMin: a, breakMin: b })}
                  className={cx('chip px-3 py-1.5 text-xs transition tnum', f.focusMin === a ? 'bg-[var(--accent)] text-white' : 'bg-panel2 text-mute hover:text-ink')}>{a}/{b}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-7 grid grid-cols-3 gap-2.5">
        {[['Today', fmtMinutes(stats.todayMin), `${stats.todayCount} session${stats.todayCount === 1 ? '' : 's'}`], ['This week', fmtMinutes(stats.weekMin), 'since Monday'], ['Streak', `${stats.streak}`, stats.streak === 1 ? 'day' : 'days']].map(([l, v, s]) => (
          <div key={l} className="card rise px-3.5 py-3">
            <div className="eyebrow text-[10px]">{l}</div>
            <div className="display mt-1 text-[30px] tnum">{v}</div>
            <div className="text-[11px] text-mute">{s}</div>
          </div>
        ))}
      </div>

      {stats.groups.length > 0 && (
        <Section title="This week by course">
          <div className="card space-y-3 p-4">
            {stats.groups.map((g) => (
              <div key={g.name}>
                <div className="mb-1 flex items-baseline justify-between text-sm"><span className="truncate">{g.name}</span><span className="text-xs text-mute tnum">{fmtMinutes(g.min)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-panel2"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(g.min / maxGroup) * 100}%`, background: g.color }} /></div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Recent sessions">
        {stats.recent.length ? (
          <div className="card divide-y divide-line overflow-hidden">
            {stats.recent.map((s) => {
              const b = db.boards.find((x) => x.id === s.board_id);
              const c = db.courses.find((x) => x.id === s.course_id);
              return (
                <div key={s.id} className="row group">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b?.color ?? 'var(--faint)' }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px]">{s.label || c?.name || 'Focus session'}</div>
                    <div className="text-[11px] text-mute">{format(parseISO(s.started_at), "EEE d MMM, HH:mm")}{c ? ` · ${c.name}` : ''}</div>
                  </div>
                  <span className="text-sm font-medium tnum">{fmtMinutes(s.minutes)}</span>
                  <button className="text-faint opacity-60 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => removeWithUndo('focus_sessions', s.id, 'Session removed')} aria-label="Delete session"><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon={<Play size={20} />} title="No sessions yet" hint="Pick what you're working on and press play. Finished sessions are logged here and per course." />
        )}
      </Section>

      <TaskPicker key={String(picking)} open={picking} onClose={() => setPicking(false)} />
    </div>
  );
}

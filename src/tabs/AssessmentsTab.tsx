import { useEffect, useState } from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { CalendarClock, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { removeWithUndo } from '../lib/toast';
import type { Assessment, AssessmentType, Board } from '../lib/types';
import { cx } from '../lib/utils';
import { CheckBox, Empty, Field, Sheet } from '../components/ui';

const TYPES: AssessmentType[] = ['quiz', 'exam', 'assignment', 'project', 'presentation', 'other'];
const TYPE_COLOR: Record<AssessmentType, string> = { quiz: '#3b82f6', exam: '#ef4444', assignment: '#f59e0b', project: '#8b5cf6', presentation: '#10b981', other: '#64748b' };

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function Countdown({ a, courseName, now }: { a: Assessment; courseName?: string; now: Date }) {
  const mins = Math.max(0, differenceInMinutes(parseISO(a.due_at!), now));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  const urgent = mins < 1440 * 2;
  return (
    <div className="relative mb-5 overflow-hidden rounded-3xl p-5 text-white shadow-xl" style={{ background: `linear-gradient(135deg, ${TYPE_COLOR[a.type]}, color-mix(in srgb, ${TYPE_COLOR[a.type]} 55%, #000))` }}>
      <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="text-xs font-medium uppercase tracking-wider text-white/75">Next up · {a.type}</div>
      <div className="mt-1 text-xl font-semibold">{a.title}</div>
      <div className="text-sm text-white/80">{courseName ? `${courseName} · ` : ''}{format(parseISO(a.due_at!), "EEE d MMM 'at' HH:mm")}</div>
      <div className="mt-4 flex gap-2">
        {[[d, 'days'], [h, 'hrs'], [m, 'min']].map(([v, l]) => (
          <div key={l} className={cx('min-w-16 rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur', urgent && 'animate-pulse [animation-duration:3s]')}>
            <div className="text-2xl font-semibold tabular-nums">{String(v).padStart(2, '0')}</div>
            <div className="text-[10px] uppercase tracking-wide text-white/75">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssessmentEditor({ a, board, onClose }: { a: Assessment | null; board: Board; onClose: () => void }) {
  const s = useStore();
  const courses = s.db.courses.filter((c) => c.board_id === board.id);
  const [title, setTitle] = useState(a?.title ?? '');
  const [type, setType] = useState<AssessmentType>(a?.type ?? 'quiz');
  const [course, setCourse] = useState(a?.course_id ?? courses[0]?.id ?? '');
  const [when, setWhen] = useState(a?.due_at ? format(parseISO(a.due_at), "yyyy-MM-dd'T'HH:mm") : '');
  const save = () => {
    if (!title.trim()) return;
    const row = { title: title.trim(), type, course_id: course || null, due_at: when ? new Date(when).toISOString() : null };
    if (a) s.update('assessments', a.id, row); else s.insert('assessments', { ...row, board_id: board.id });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={a ? 'Edit assessment' : 'New assessment'}
      footer={<div className="flex gap-2">
        {a && <button className="btn-ghost text-red-500" onClick={() => { removeWithUndo('assessments', a.id, 'Assessment deleted'); onClose(); }}><Trash2 size={16} /> Delete</button>}
        <div className="flex-1" /><button className="btn-primary" onClick={save}>Save</button>
      </div>}>
      <div className="space-y-3">
        <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quiz 2" autoFocus={!a} /></Field>
        <Field label="Type">
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button key={t} onClick={() => setType(t)} className={cx('chip px-2.5 py-1 text-xs capitalize', type === t ? 'text-white' : 'bg-panel2 text-mute')} style={type === t ? { background: TYPE_COLOR[t] } : undefined}>{t}</button>
            ))}
          </div>
        </Field>
        <Field label="Course">
          <select className="input" value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">None</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Date & time"><input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}

export default function AssessmentsTab({ board }: { board: Board }) {
  const s = useStore();
  const now = useNow();
  const [editing, setEditing] = useState<Assessment | 'new' | null>(null);
  const [showDone, setShowDone] = useState(false);
  const list = s.db.assessments.filter((a) => a.board_id === board.id);
  const courseName = (id: string | null) => s.db.courses.find((c) => c.id === id)?.name;
  const upcoming = list.filter((a) => !a.done).sort((a, b) => (a.due_at ?? '9').localeCompare(b.due_at ?? '9'));
  const done = list.filter((a) => a.done);
  const next = upcoming.find((a) => a.due_at && parseISO(a.due_at) > now);

  const Row = ({ a }: { a: Assessment }) => {
    const past = a.due_at && parseISO(a.due_at) < now && !a.done;
    return (
      <div className="row cursor-pointer" onClick={() => setEditing(a)}>
        <CheckBox checked={a.done} onChange={() => s.update('assessments', a.id, { done: !a.done })} color={TYPE_COLOR[a.type]} />
        <div className="min-w-0 flex-1">
          <div className={cx('truncate text-[15px]', a.done && 'text-faint line-through')}>{a.title}</div>
          <div className="truncate text-[11px] text-mute">{courseName(a.course_id) ?? 'No course'}</div>
        </div>
        <span className="chip capitalize" style={{ background: `${TYPE_COLOR[a.type]}22`, color: TYPE_COLOR[a.type] }}>{a.type}</span>
        <span className={cx('w-20 text-right text-xs tabular-nums', past ? 'text-red-500' : 'text-mute')}>{a.due_at ? format(parseISO(a.due_at), 'd MMM HH:mm') : 'No date'}</span>
      </div>
    );
  };

  return (
    <div>
      {next && <Countdown a={next} courseName={courseName(next.course_id)} now={now} />}
      <div className="mb-3 flex items-center">
        <div className="flex-1 text-sm text-mute">{upcoming.length} upcoming</div>
        <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Assessment</button>
      </div>
      {upcoming.length ? (
        <div className="card divide-y divide-line overflow-hidden">{upcoming.map((a) => <Row key={a.id} a={a} />)}</div>
      ) : (
        <Empty icon={<CalendarClock size={22} />} title="No upcoming assessments" hint="Add quizzes, exams and deadlines to get a live countdown here and on Today." />
      )}
      {done.length > 0 && (
        <div className="mt-5">
          <button className="mb-1.5 flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wider text-mute" onClick={() => setShowDone(!showDone)}>
            <ChevronDown size={14} className={cx('transition', !showDone && '-rotate-90')} /> Done · {done.length}
          </button>
          {showDone && <div className="card divide-y divide-line overflow-hidden">{done.map((a) => <Row key={a.id} a={a} />)}</div>}
        </div>
      )}
      {editing && <AssessmentEditor a={editing === 'new' ? null : editing} board={board} onClose={() => setEditing(null)} />}
    </div>
  );
}

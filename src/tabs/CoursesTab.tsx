import { useState } from 'react';
import { BookMarked, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { removeWithUndo, toast } from '../lib/toast';
import { componentResult, courseResult, fmtScore, parseScore, type CourseResult } from '../lib/grades';
import type { Board, Course, GradeComponent, Score } from '../lib/types';
import { cx, maxPos } from '../lib/utils';
import { Empty, Field, Sheet } from '../components/ui';

function ScoreInput({ value, onChange, counted, label }: { value: Score; onChange: (s: Score) => void; counted: boolean; label: string }) {
  const [text, setText] = useState(fmtScore(value));
  const [bad, setBad] = useState(false);
  const [focus, setFocus] = useState(false);
  const shown = focus ? text : fmtScore(value);
  return (
    <label className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-faint">{label}</span>
      <input
        inputMode="decimal" placeholder="–" value={shown} aria-label={label}
        onFocus={(e) => { setFocus(true); setText(fmtScore(value)); setTimeout(() => e.target.select(), 0); }}
        onChange={(e) => { setText(e.target.value); setBad(false); }}
        onBlur={() => {
          setFocus(false);
          const parsed = parseScore(text);
          if (text.trim() && !parsed) { setBad(true); toast('Use a score like 17/20 or 85%'); return; }
          onChange(parsed);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={cx('w-[62px] rounded-lg border bg-panel px-1 py-1.5 text-center text-sm tabular-nums outline-none transition focus:border-[var(--accent)]',
          bad ? 'border-red-500' : value && !counted ? 'border-line text-faint line-through' : value ? 'border-transparent bg-panel2 font-medium' : 'border-dashed border-line')}
      />
    </label>
  );
}

const STATUS: Record<CourseResult['status'], { text: (r: CourseResult, t: number) => string; cls: string }> = {
  'no-data': { text: () => 'Enter scores to see where you stand', cls: 'text-mute' },
  done: { text: (r) => `Final: ${r.earned.toFixed(1)}%`, cls: 'text-mute' },
  secured: { text: (_, t) => `${t}% secured, whatever happens next 🎉`, cls: 'text-emerald-500' },
  'on-track': { text: (r) => `Need avg ${r.needed!.toFixed(0)}% on the remaining ${r.remaining.toFixed(0)}%`, cls: 'text-ink' },
  stretch: { text: (r) => `Stretch: need avg ${r.needed!.toFixed(0)}% on the remaining ${r.remaining.toFixed(0)}%`, cls: 'text-amber-500' },
  'out-of-reach': { text: (r) => `Out of reach. Max possible now ${r.maxPossible.toFixed(1)}%`, cls: 'text-red-500' },
};

function ComponentEditor({ comp, courseId, onClose }: { comp: GradeComponent | null; courseId: string; onClose: () => void }) {
  const s = useStore();
  const [name, setName] = useState(comp?.name ?? '');
  const [weight, setWeight] = useState(String(comp?.weight ?? ''));
  const [items, setItems] = useState(String(comp?.item_count ?? 1));
  const [best, setBest] = useState(comp?.best_of ? String(comp.best_of) : '');
  const save = () => {
    const w = Number(weight), n = Math.max(1, Math.round(Number(items) || 1)), k = best ? Math.min(n, Math.max(1, Math.round(Number(best)))) : null;
    if (!name.trim() || !(w >= 0 && w <= 100)) return toast('Give it a name and a weight between 0 and 100');
    const scores = [...(comp?.scores ?? [])].slice(0, n);
    while (scores.length < n) scores.push(null);
    const patch = { name: name.trim(), weight: w, item_count: n, best_of: k && k < n ? k : null, scores };
    if (comp) s.update('grade_components', comp.id, patch);
    else s.insert('grade_components', { ...patch, course_id: courseId, position: maxPos(s.db.grade_components.filter((c) => c.course_id === courseId)) });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={comp ? 'Edit component' : 'Add component'}
      footer={<div className="flex gap-2">
        {comp && <button className="btn-ghost text-red-500" onClick={() => { removeWithUndo('grade_components', comp.id, 'Component removed'); onClose(); }}><Trash2 size={16} /> Remove</button>}
        <div className="flex-1" /><button className="btn-primary" onClick={save}>Save</button>
      </div>}>
      <div className="space-y-3">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quizzes" autoFocus={!comp} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Weight %"><input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
          <Field label="No. of items"><input className="input" inputMode="numeric" value={items} onChange={(e) => setItems(e.target.value)} /></Field>
          <Field label="Best of (opt.)"><input className="input" inputMode="numeric" value={best} onChange={(e) => setBest(e.target.value)} placeholder="all" /></Field>
        </div>
        <p className="text-xs text-mute">"Best 3 of 4" = 4 items, best of 3. The lowest score is dropped automatically.</p>
      </div>
    </Sheet>
  );
}

function CourseCard({ course, color }: { course: Course; color: string }) {
  const s = useStore();
  const comps = s.db.grade_components.filter((c) => c.course_id === course.id).sort((a, b) => a.position - b.position);
  const r = courseResult(comps, Number(course.target));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GradeComponent | 'new' | null>(null);
  const [editCourse, setEditCourse] = useState(false);
  const st = STATUS[r.status];

  const setScore = (c: GradeComponent, i: number, v: Score) => {
    const scores = [...c.scores];
    while (scores.length < c.item_count) scores.push(null);
    scores[i] = v;
    s.update('grade_components', c.id, { scores });
  };

  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(!open)}>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{course.name}</div>
          <div className="text-xs text-mute">{course.code ? `${course.code} · ` : ''}Target {Number(course.target)}%</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums" style={{ color: r.current === null ? 'var(--faint)' : color }}>{r.current === null ? '–' : `${r.current.toFixed(1)}%`}</div>
          <div className="text-[10px] uppercase tracking-wide text-faint">current</div>
        </div>
        <ChevronDown size={18} className={cx('text-faint transition', open && 'rotate-180')} />
      </button>
      <div className="px-4 pb-3">
        {/* earned (solid) vs still available (light) out of 100 */}
        <div className="relative h-2 overflow-hidden rounded-full bg-panel2">
          <div className="absolute inset-y-0 left-0 rounded-full opacity-25" style={{ width: `${Math.min(100, r.earned + r.remaining)}%`, background: color }} />
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, r.earned)}%`, background: color }} />
          <div className="absolute inset-y-[-2px] w-0.5 bg-ink" style={{ left: `${Math.min(100, Number(course.target))}%` }} title="Target" />
        </div>
        <div className={cx('mt-2 text-sm', st.cls)}>{st.text(r, Number(course.target))}</div>
        {Math.abs(r.totalWeight - 100) > 0.01 && <div className="mt-1 text-xs text-amber-500">Weights add up to {r.totalWeight}%, not 100%.</div>}
      </div>
      {open && (
        <div className="border-t border-line">
          {comps.map((c) => {
            const cr = componentResult(c);
            return (
              <div key={c.id} className="border-b border-line/70 px-4 py-3 last:border-0">
                <div className="mb-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="ml-2 text-xs text-mute">{Number(c.weight)}%{c.best_of ? ` · best ${c.best_of} of ${c.item_count}` : ''}</span>
                  </div>
                  <span className="text-xs tabular-nums text-mute">{cr.earned.toFixed(1)}/{Number(c.weight)}</span>
                  <button className="text-faint hover:text-ink" onClick={() => setEditing(c)} aria-label="Edit component"><Pencil size={13} /></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: c.item_count }).map((_, i) => (
                    <ScoreInput key={i} label={c.item_count > 1 ? `#${i + 1}` : 'Score'} value={c.scores[i] ?? null} counted={cr.counted.has(i)} onChange={(v) => setScore(c, i, v)} />
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-2 bg-panel2/40 px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-mute">Target
              <input className="w-16 rounded-lg border border-line bg-panel px-2 py-1 text-center text-sm text-ink outline-none focus:border-[var(--accent)]" inputMode="decimal" defaultValue={Number(course.target)}
                onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v <= 100) s.update('courses', course.id, { target: v }); }} />%
            </label>
            <div className="flex-1" />
            <button className="btn-ghost text-xs" onClick={() => setEditing('new')}><Plus size={14} /> Component</button>
            <button className="btn-ghost text-xs" onClick={() => setEditCourse(true)}><Pencil size={14} /> Course</button>
          </div>
        </div>
      )}
      {editing && <ComponentEditor comp={editing === 'new' ? null : editing} courseId={course.id} onClose={() => setEditing(null)} />}
      {editCourse && <CourseEditor course={course} boardId={course.board_id} onClose={() => setEditCourse(false)} />}
    </div>
  );
}

function CourseEditor({ course, boardId, onClose }: { course: Course | null; boardId: string; onClose: () => void }) {
  const s = useStore();
  const [name, setName] = useState(course?.name ?? '');
  const [code, setCode] = useState(course?.code ?? '');
  const save = () => {
    if (!name.trim()) return;
    if (course) s.update('courses', course.id, { name: name.trim(), code: code.trim() || null });
    else s.insert('courses', { board_id: boardId, name: name.trim(), code: code.trim() || null, position: maxPos(s.db.courses.filter((c) => c.board_id === boardId)) });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={course ? 'Edit course' : 'New course'}
      footer={<div className="flex gap-2">
        {course && <button className="btn-ghost text-red-500" onClick={() => { removeWithUndo('courses', course.id, `Removed ${course.name}`); onClose(); }}><Trash2 size={16} /> Delete</button>}
        <div className="flex-1" /><button className="btn-primary" onClick={save}>Save</button>
      </div>}>
      <div className="space-y-3">
        <Field label="Course name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Code (optional)"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SMCC2271" /></Field>
      </div>
    </Sheet>
  );
}

export default function CoursesTab({ board }: { board: Board }) {
  const courses = useStore((s) => s.db.courses).filter((c) => c.board_id === board.id).sort((a, b) => a.position - b.position);
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <p className="flex-1 text-sm text-mute">Tap a course to enter scores, as <span className="text-ink">17/20</span> or <span className="text-ink">85%</span>.</p>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Course</button>
      </div>
      {courses.length ? (
        <div className="space-y-3">{courses.map((c) => <CourseCard key={c.id} course={c} color={board.color} />)}</div>
      ) : (
        <Empty icon={<BookMarked size={22} />} title="No courses" hint="Add a course and its grade components to track your standing." />
      )}
      {adding && <CourseEditor course={null} boardId={board.id} onClose={() => setAdding(false)} />}
    </div>
  );
}


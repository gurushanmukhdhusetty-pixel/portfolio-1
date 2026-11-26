import { useMemo, useState } from 'react';
import { addDays, format, isToday } from 'date-fns';
import { Flame, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { haptic, removeWithUndo } from '../lib/toast';
import type { Board, Habit } from '../lib/types';
import { cx, maxPos, toISO, todayISO } from '../lib/utils';
import { Empty, Sheet } from '../components/ui';

/** Consecutive days ending today (or yesterday, so an unticked today doesn't break it yet). */
export function streak(days: Set<string>) {
  let d = new Date();
  if (!days.has(toISO(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(toISO(d))) { n++; d = addDays(d, -1); }
  return n;
}

function HabitRow({ habit, color, onEdit }: { habit: Habit; color: string; onEdit: () => void }) {
  const s = useStore();
  const logs = s.db.habit_logs.filter((l) => l.habit_id === habit.id);
  const days = useMemo(() => new Set(logs.map((l) => l.day)), [logs]);
  const week = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));
  const st = streak(days);
  const last30 = Array.from({ length: 30 }, (_, i) => toISO(addDays(new Date(), -i))).filter((d) => days.has(d)).length;
  const toggle = (iso: string) => {
    const hit = logs.find((l) => l.day === iso);
    if (hit) s.remove('habit_logs', hit.id);
    else { haptic(); s.insert('habit_logs', { habit_id: habit.id, day: iso }); }
  };
  const doneToday = days.has(todayISO());
  return (
    <div className="px-3 py-3">
      <div className="mb-2.5 flex items-center gap-2">
        <button className="min-w-0 flex-1 truncate text-left text-[15px] font-medium" onClick={onEdit}>{habit.name}</button>
        <span className={cx('flex items-center gap-1 text-sm font-semibold tabular-nums', st ? 'text-orange-500' : 'text-faint')}>
          <Flame size={15} fill={st ? 'currentColor' : 'none'} /> {st}
        </span>
        <span className="w-14 text-right text-[11px] text-faint">{Math.round((last30 / 30) * 100)}% · 30d</span>
      </div>
      <div className="flex items-center gap-1.5">
        {week.map((d) => {
          const iso = toISO(d), on = days.has(iso), today = isToday(d);
          return (
            <button key={iso} onClick={() => toggle(iso)} className="flex flex-1 flex-col items-center gap-1" aria-label={`${habit.name} ${format(d, 'EEE')}`}>
              <span className={cx('text-[10px] uppercase', today ? 'font-semibold text-ink' : 'text-faint')}>{format(d, 'EEEEE')}</span>
              <span className={cx('grid aspect-square w-full max-w-10 place-items-center rounded-xl text-xs font-medium transition active:scale-90', on ? 'text-white shadow-sm' : 'bg-panel2 text-faint', today && !on && 'ring-2 ring-[var(--accent)]/50')}
                style={on ? { background: color } : undefined}>
                {on ? '✓' : format(d, 'd')}
              </span>
            </button>
          );
        })}
      </div>
      {!doneToday && st > 0 && <div className="mt-2 text-[11px] text-orange-500">Tick today to keep your {st}-day streak</div>}
    </div>
  );
}

export default function HabitsTab({ board }: { board: Board }) {
  const s = useStore();
  const habits = s.db.habits.filter((h) => h.board_id === board.id && !h.archived).sort((a, b) => a.position - b.position);
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<Habit | null>(null);
  const today = todayISO();
  const doneToday = habits.filter((h) => s.db.habit_logs.some((l) => l.habit_id === h.id && l.day === today)).length;
  const add = () => {
    if (!name.trim()) return;
    s.insert('habits', { board_id: board.id, name: name.trim(), position: maxPos(habits) });
    setName('');
  };
  return (
    <div>
      {habits.length > 0 && (
        <div className="mb-3 flex items-center gap-3 px-1">
          <div className="flex-1 text-sm text-mute">{doneToday === habits.length ? 'All done today. Nice. ✨' : `${doneToday} of ${habits.length} done today`}</div>
        </div>
      )}
      <div className="card mb-3 flex items-center gap-2 py-1 pr-1.5 pl-3">
        <Plus size={18} className="text-[var(--accent)]" />
        <input className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-faint" placeholder="New habit, e.g. Read 20 pages" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        {name && <button className="btn-primary px-2.5 py-1.5" onClick={add}>Add</button>}
      </div>
      {habits.length ? (
        <div className="card divide-y divide-line overflow-hidden">{habits.map((h) => <HabitRow key={h.id} habit={h} color={board.color} onEdit={() => setEdit(h)} />)}</div>
      ) : (
        <Empty icon={<Flame size={22} />} title="No habits yet" hint="Small daily things. Tick a day to build a streak. Tap any of the last 7 days to backfill." />
      )}
      {edit && (
        <Sheet open onClose={() => setEdit(null)} title="Habit"
          footer={<div className="flex gap-2">
            <button className="btn-ghost text-red-500" onClick={() => { removeWithUndo('habits', edit.id, 'Habit deleted'); setEdit(null); }}><Trash2 size={16} /> Delete</button>
            <div className="flex-1" />
            <button className="btn-ghost" onClick={() => { s.update('habits', edit.id, { archived: true }); setEdit(null); }}>Archive</button>
            <button className="btn-primary" onClick={() => setEdit(null)}>Done</button>
          </div>}>
          <input className="input text-base" value={s.db.habits.find((h) => h.id === edit.id)?.name ?? ''} onChange={(e) => s.update('habits', edit.id, { name: e.target.value })} autoFocus />
        </Sheet>
      )}
    </div>
  );
}

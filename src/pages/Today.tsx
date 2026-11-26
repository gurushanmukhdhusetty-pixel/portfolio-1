import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { differenceInMinutes, format, isToday, parseISO } from 'date-fns';
import { Cake, CalendarClock, Flame, PartyPopper, Play, Plus, ScanFace, Sparkles, Star, Timer, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { sortTodos, toggleTodo, toggleTop3 } from '../lib/todos';
import { elapsedOf, fmtClock, fmtMinutes, useFocus, useNowWhile } from '../lib/focus';
import { nextBirthday, todayISO, cx } from '../lib/utils';
import { confetti } from '../lib/confetti';
import { toast } from '../lib/toast';
import { biometricName, deviceHasPasskey, passkeyError, passkeysSupported, registerPasskey } from '../lib/passkey';
import { useUI } from '../lib/ui';
import type { Todo } from '../lib/types';
import { TodoItem } from '../components/TodoItem';
import { LifeRing } from '../components/LifeRing';
import { CheckBox, DueChip, PageHeader, SearchInput, Section, Sheet } from '../components/ui';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late,' : h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
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

function FaceIdNudge() {
  const KEY = 'lifeos-faceid-nudge';
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(KEY) === '1'; } catch { /* ignore */ }
    if (dismissed || deviceHasPasskey()) return;
    passkeysSupported().then((ok) => ok && /iPhone|iPad|Android/.test(navigator.userAgent) && setShow(true)).catch(() => {});
  }, []);
  if (!show) return null;
  const hide = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setShow(false); };
  const setup = async () => {
    setBusy(true);
    try { await registerPasskey(); toast(`${biometricName()} unlock is on`); hide(); }
    catch (e) { const m = passkeyError(e); if (m !== 'Cancelled') toast(m); }
    setBusy(false);
  };
  return (
    <div className="card rise relative flex items-center gap-3 overflow-hidden p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-emerald-500/15 text-emerald-500"><ScanFace size={20} /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">Unlock with {biometricName()}</div>
        <div className="text-xs text-mute">Skip the password next time.</div>
      </div>
      <button className="btn-primary py-1.5" disabled={busy} onClick={setup}>Set up</button>
      <button className="btn-ghost h-8 w-8 p-0 text-faint" onClick={hide} aria-label="Not now"><X size={15} /></button>
    </div>
  );
}

function Tile({ to, icon, color, label, value, sub, onClick, children }: { to?: string; icon: React.ReactNode; color: string; label: string; value: React.ReactNode; sub: React.ReactNode; onClick?: () => void; children?: React.ReactNode }) {
  const body = (
    <>
      <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
      <div className="relative mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-[9px]" style={{ background: `${color}22`, color }}>{icon}</span>
        <span className="eyebrow text-[10px]">{label}</span>
        {children}
      </div>
      <div className="display relative truncate text-[28px] tnum">{value}</div>
      <div className="relative truncate text-xs text-mute">{sub}</div>
    </>
  );
  const cls = 'card relative block overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]';
  return to ? <Link to={to} className={cls}>{body}</Link> : <button onClick={onClick} className={cls}>{body}</button>;
}

function Tiles() {
  const { boards, habits, habit_logs, assessments, people, focus_sessions } = useStore((s) => s.db);
  const f = useFocus();
  const nav = useNavigate();
  const now = useNowWhile(f.phase !== 'idle' && f.running);
  const today = todayISO();
  const personal = boards.find((b) => b.kind === 'personal' && !b.archived);
  const academics = boards.find((b) => b.kind === 'academics' && !b.archived);
  const hs = habits.filter((h) => !h.archived && h.board_id === personal?.id);
  const hDone = hs.filter((h) => habit_logs.some((l) => l.habit_id === h.id && l.day === today)).length;
  const focusMin = focus_sessions.filter((s) => isToday(parseISO(s.started_at))).reduce((n, s) => n + s.minutes, 0);
  const next = assessments.filter((a) => !a.done && a.due_at && parseISO(a.due_at) > new Date()).sort((a, b) => a.due_at!.localeCompare(b.due_at!))[0];
  const mins = next ? differenceInMinutes(parseISO(next.due_at!), new Date()) : 0;
  const bday = people.map((p) => ({ p, nb: nextBirthday(p) })).filter((x) => x.nb && x.nb.days <= 30).sort((a, b) => a.nb!.days - b.nb!.days)[0];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Tile icon={<Timer size={15} />} color="#8b5cf6" label="Focus" onClick={() => nav('/focus')}
        value={f.phase !== 'idle' ? fmtClock(f.duration - elapsedOf(f, now)) : fmtMinutes(focusMin)}
        sub={f.phase === 'focus' ? (f.running ? 'in session' : 'paused') : f.phase === 'break' ? 'on a break' : focusMin ? 'focused today' : 'Tap to start a session'}>
        {f.phase === 'idle' && <Play size={13} className="ml-auto text-faint" fill="currentColor" />}
        {f.phase !== 'idle' && <span className="pulse-dot ml-auto h-2 w-2 rounded-full bg-violet-500" />}
      </Tile>
      <Tile to={personal ? `/b/${personal.id}?tab=habits` : '/boards'} icon={<Flame size={15} />} color="#f97316" label="Habits"
        value={hs.length ? <>{hDone}<span className="text-faint">/{hs.length}</span></> : '–'} sub={hs.length ? (hDone === hs.length ? 'all done today ✨' : 'done today') : 'Add habits to track'} />
      <Tile to={academics ? `/b/${academics.id}?tab=assessments` : '/boards'} icon={<CalendarClock size={15} />} color="#3b82f6" label="Next exam"
        value={next ? (mins >= 1440 ? `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h` : `${Math.floor(mins / 60)}h ${mins % 60}m`) : '–'}
        sub={next ? next.title : 'Nothing scheduled'} />
      <Tile to={bday ? `/b/${bday.p.board_id}?tab=people` : personal ? `/b/${personal.id}?tab=people` : '/boards'} icon={bday?.nb!.days === 0 ? <PartyPopper size={15} /> : <Cake size={15} />} color="#ec4899" label="Birthday"
        value={bday ? (bday.nb!.days === 0 ? 'Today!' : bday.nb!.days === 1 ? 'Tomorrow' : `${bday.nb!.days} days`) : '–'}
        sub={bday ? `${bday.p.name}${bday.nb!.turning ? ` turns ${bday.nb!.turning}` : ''}` : 'None in the next 30 days'} />
    </div>
  );
}

export default function Today() {
  const { todos, boards } = useStore((s) => s.db);
  const openTodo = useUI((s) => s.openTodo);
  const [picking, setPicking] = useState(false);
  const today = todayISO();

  const liveBoards = useMemo(() => boards.filter((b) => !b.archived).sort((a, b) => a.position - b.position), [boards]);
  const live = useMemo(() => new Set(liveBoards.map((b) => b.id)), [liveBoards]);
  const visible = (t: Todo) => !t.board_id || live.has(t.board_id);
  const top = todos.filter((t) => t.top3 && t.status !== 'done' && visible(t)).sort((a, b) => a.top3! - b.top3!);
  const due = todos.filter((t) => !t.parent_id && t.status !== 'done' && t.due_date && t.due_date <= today && visible(t)).sort(sortTodos);
  const overdue = due.filter((t) => t.due_date! < today);
  const dueToday = due.filter((t) => t.due_date === today);
  const doneToday = todos.filter((t) => !t.parent_id && t.status === 'done' && t.completed_at && isToday(parseISO(t.completed_at)) && visible(t));
  const segments = liveBoards.map((b) => {
    const open = due.filter((t) => t.board_id === b.id).length, done = doneToday.filter((t) => t.board_id === b.id).length;
    return { id: b.id, name: b.name, color: b.color, done, total: open + done };
  });
  const total = due.length + doneToday.length;

  // the moment the last thing due today is ticked off
  const prev = useRef(due.length);
  useEffect(() => {
    if (prev.current > 0 && due.length === 0 && doneToday.length > 0) { confetti(); toast('All clear for today 🎉'); }
    prev.current = due.length;
  }, [due.length, doneToday.length]);

  const ringCard = (
    <div className="card rise relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full opacity-[0.12] blur-3xl" style={{ background: 'conic-gradient(#3b82f6, #8b5cf6, #f43f5e, #f59e0b, #10b981, #3b82f6)' }} />
      <div className="relative flex items-center gap-5">
        <LifeRing segments={segments} size={150}>
          {total ? (
            <div className="text-center">
              <div className="display text-[40px] leading-none tnum">{doneToday.length}<span className="text-[22px] text-faint">/{total}</span></div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-mute">done</div>
            </div>
          ) : (
            <div className="text-center"><Sparkles size={22} className="mx-auto text-amber-400" /><div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-mute">clear</div></div>
          )}
        </LifeRing>
        <div className="min-w-0 flex-1 space-y-1.5">
          {segments.map((s) => (
            <Link key={s.id} to={`/b/${s.id}`} className="flex items-center gap-2 rounded-lg text-[13px] transition hover:opacity-80">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color, opacity: s.total ? 1 : 0.35 }} />
              <span className={cx('min-w-0 flex-1 truncate', !s.total && 'text-faint')}>{s.name}</span>
              <span className={cx('tnum text-xs', s.total && s.done === s.total ? 'text-emerald-500' : 'text-mute')}>{s.total ? `${s.done}/${s.total}` : '–'}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader compact="Today" eyebrow={format(new Date(), 'EEEE, d MMMM')}
        title={<>{greeting()}<br /><em className="text-[var(--accent)]">Shanmukh</em></>}
        subtitle={due.length === 0 ? (doneToday.length ? `${doneToday.length} done today. Nothing left due.` : 'Nothing due. Clear runway.') : `${dueToday.length} due today${overdue.length ? ` · ${overdue.length} overdue` : ''}`} />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-7">
        <div className="flex flex-col gap-4 lg:sticky lg:top-8">
          {ringCard}
          <div className="hidden lg:block"><Tiles /></div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="mb-6 empty:hidden"><FaceIdNudge /></div>
          <Section title={<span className="flex items-center gap-1.5"><Star size={12} className="text-amber-400" fill="currentColor" /> Top 3</span>}>
            <div className="space-y-2">
              {[1, 2, 3].map((slot) => {
                const t = top.find((x) => x.top3 === slot);
                const b = t && boards.find((x) => x.id === t.board_id);
                if (!t) return (
                  <button key={slot} onClick={() => setPicking(true)} className="flex w-full items-center gap-3.5 rounded-[18px] border border-dashed border-line px-4 py-3.5 text-sm text-faint transition hover:border-[var(--accent)] hover:text-ink">
                    <span className="display w-5 text-center text-[26px] leading-none">{slot}</span>
                    <span className="flex-1 text-left">Pin a priority</span><Plus size={16} />
                  </button>
                );
                return (
                  <div key={slot} onClick={() => openTodo(t.id)} className="card group relative flex cursor-pointer items-center gap-3.5 overflow-hidden px-4 py-3.5 transition hover:shadow-lg">
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-24 opacity-[0.13]" style={{ background: `linear-gradient(90deg, ${b?.color ?? 'var(--accent)'}, transparent)` }} />
                    <span className="display relative w-5 text-center text-[26px] leading-none" style={{ color: b?.color ?? 'var(--accent)' }}>{slot}</span>
                    <CheckBox checked={false} onChange={() => toggleTodo(t)} color={b?.color} size={24} />
                    <div className="relative min-w-0 flex-1">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-[11px] text-mute">{b?.name ?? 'Inbox'}{t.due_date ? ' · ' : ''}{t.due_date && <DueChip due={t.due_date} />}</div>
                    </div>
                    <button className="relative text-faint opacity-60 transition hover:text-ink sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); toggleTop3(t); }} aria-label="Unpin"><X size={15} /></button>
                  </div>
                );
              })}
            </div>
          </Section>

          {overdue.length > 0 && (
            <Section title={<span className="text-red-500">Overdue · {overdue.length}</span>}>
              <div className="card divide-y divide-line overflow-hidden">{overdue.map((t) => <TodoItem key={t.id} todo={t} onOpen={(x) => openTodo(x.id)} showBoard />)}</div>
            </Section>
          )}
          <Section title={`Due today · ${dueToday.length}`}>
            {dueToday.length ? (
              <div className="card divide-y divide-line overflow-hidden">{dueToday.map((t) => <TodoItem key={t.id} todo={t} onOpen={(x) => openTodo(x.id)} showBoard />)}</div>
            ) : (
              <div className="card flex items-center gap-3 px-4 py-5 text-sm text-mute">
                <Sparkles size={18} className="shrink-0 text-amber-400" />
                <span>Nothing due today. Tap <span className="font-semibold text-ink">+</span> to capture something.</span>
              </div>
            )}
          </Section>

          <div className="mb-7 lg:hidden"><Tiles /></div>

          {doneToday.length > 0 && (
            <Section title={`Done today · ${doneToday.length}`}>
              <div className="card divide-y divide-line overflow-hidden opacity-75">{doneToday.map((t) => <TodoItem key={t.id} todo={t} onOpen={(x) => openTodo(x.id)} showBoard />)}</div>
            </Section>
          )}
        </div>
      </div>

      <Top3Picker open={picking} onClose={() => setPicking(false)} />
    </div>
  );
}

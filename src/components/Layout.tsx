import { useEffect, useMemo, useRef } from 'react';
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { CalendarDays, Inbox, LayoutGrid, Moon, Plus, Search, Settings, Sun, Sunrise, Timer } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { useTheme } from '../lib/theme';
import { useFocus, useFocusTicker } from '../lib/focus';
import { boardIcon } from '../lib/icons';
import { cx } from '../lib/utils';
import QuickCapture from './QuickCapture';
import { ErrorBoundary } from './ErrorBoundary';
import { Logo } from './Logo';
import { Toasts } from './Toasts';
import { CommandPalette } from './CommandPalette';
import { FocusIsland } from './FocusIsland';
import { LockScreen, useAppLock } from './LockScreen';
import { TodoEditor } from './TodoEditor';
import { NoteEditor } from './NoteEditor';
import { Kbd, useSlider } from './ui';

function SyncDot({ withLabel }: { withLabel?: boolean }) {
  const pending = useStore((s) => s.queue.length);
  const error = useStore((s) => s.error);
  const syncing = useStore((s) => s.syncing);
  const color = error ? 'bg-red-500' : pending || syncing ? 'bg-amber-400 pulse-dot' : 'bg-emerald-500';
  const label = error ?? (pending ? 'Saving…' : syncing ? 'Syncing…' : 'All changes saved');
  return (
    <button title={label} aria-label={label} onClick={() => useStore.getState().sync(true)} className="flex min-w-0 items-center gap-2 p-1 text-xs text-mute">
      <span className={cx('h-2 w-2 shrink-0 rounded-full', color)} />
      {withLabel && <span className="truncate">{label}</span>}
    </button>
  );
}

const origin = (e: React.MouseEvent) => ({ x: e.clientX, y: e.clientY });

export default function Layout() {
  const boards = useStore((s) => s.db.boards);
  const inboxCount = useStore((s) => s.db.todos.filter((t) => !t.board_id && t.status !== 'done' && !t.parent_id).length + s.db.notes.filter((n) => !n.board_id && !n.person_id).length);
  const active = useMemo(() => boards.filter((b) => !b.archived).sort((a, b) => a.position - b.position), [boards]);
  const m = useMatch('/b/:id');
  const current = boards.find((b) => b.id === m?.params.id);
  const focusPhase = useFocus((s) => s.phase);
  const accent = current?.color ?? '#6366f1';
  const ui = useUI();
  const { dark, toggle } = useTheme();
  const loc = useLocation();
  const navigate = useNavigate();
  const topbar = useRef<HTMLDivElement>(null);
  useFocusTicker();
  useAppLock();

  useEffect(() => { document.documentElement.style.setProperty('--accent', accent); }, [accent]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  // expose the phone top bar's height so sticky sub-headers sit flush under it
  useEffect(() => {
    const el = topbar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return;
      if (e.key === 'n') { e.preventDefault(); useUI.getState().openCapture('todo'); }
      if (e.key === '/') { e.preventDefault(); if (window.matchMedia('(min-width: 768px)').matches) useUI.getState().setPalette(true); else navigate('/search'); }
      if (e.key === 'f') { e.preventDefault(); navigate('/focus'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const nav = [
    { to: '/', icon: Sunrise, label: 'Today', end: true },
    { to: '/week', icon: CalendarDays, label: 'Week' },
    { to: '/inbox', icon: Inbox, label: 'Inbox', badge: inboxCount },
    { to: '/focus', icon: Timer, label: 'Focus', live: focusPhase !== 'idle' },
  ];

  // dock: which tab is "on" (board pages count as Boards)
  const dockKey = loc.pathname === '/' ? '/' : ['/week', '/boards', '/focus'].find((p) => loc.pathname.startsWith(p)) ?? (m ? '/boards' : '');
  const dock = useSlider(dockKey);
  const dockItems = [
    { to: '/', icon: Sunrise, label: 'Today' },
    { to: '/week', icon: CalendarDays, label: 'Week' },
    null,
    { to: '/boards', icon: LayoutGrid, label: 'Boards' },
    { to: '/focus', icon: Timer, label: 'Focus' },
  ];

  return (
    <div className="min-h-dvh md:flex">
      {/* ---------- desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line/80 px-3 py-5 md:flex">
        <div className="mb-5 flex items-center gap-2.5 px-2.5">
          <Logo size={26} className="text-ink" />
          <span className="display text-[24px]">Life OS</span>
        </div>
        <button onClick={() => ui.setPalette(true)} className="mb-4 flex items-center gap-2 rounded-[12px] border border-line bg-panel px-3 py-2 text-sm text-faint transition hover:text-mute" style={{ boxShadow: 'var(--card-shadow)' }}>
          <Search size={15} /> <span className="flex-1 text-left">Search or jump…</span> <Kbd>⌘K</Kbd>
        </button>
        <nav className="space-y-0.5">
          {nav.map(({ to, icon: I, label, end, badge, live }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-[12px] px-2.5 py-2 text-sm transition', isActive ? 'bg-panel font-medium text-ink shadow-[var(--card-shadow)]' : 'text-mute hover:bg-panel2/70 hover:text-ink')}>
              <I size={17} /> <span className="flex-1">{label}</span>
              {!!badge && <span className="chip bg-panel2 text-mute tnum">{badge}</span>}
              {live && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
            </NavLink>
          ))}
        </nav>
        <div className="eyebrow mt-7 mb-1.5 flex items-center px-2.5 text-[10px]">
          <span className="flex-1">Boards</span>
          <NavLink to="/boards" className="rounded-md px-1 normal-case tracking-normal text-faint hover:text-ink">Manage</NavLink>
        </div>
        <nav className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
          {active.map((b) => {
            const I = boardIcon(b.icon);
            return (
              <NavLink key={b.id} to={`/b/${b.id}`} className={({ isActive }) => cx('flex items-center gap-3 rounded-[12px] px-2.5 py-1.5 text-sm transition', isActive ? 'bg-panel font-medium text-ink shadow-[var(--card-shadow)]' : 'text-mute hover:bg-panel2/70 hover:text-ink')}>
                <span className="grid h-7 w-7 place-items-center rounded-[9px]" style={{ background: `${b.color}1f`, color: b.color }}><I size={15} /></span>
                <span className="truncate">{b.name}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-3 flex items-center gap-1 border-t border-line pt-3">
          <div className="min-w-0 flex-1 px-1"><SyncDot withLabel /></div>
          <button className="btn-ghost h-9 w-9 p-0" onClick={(e) => toggle(origin(e))} title="Toggle theme" aria-label="Toggle theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <NavLink to="/settings" className={({ isActive }) => cx('btn-ghost h-9 w-9 p-0', isActive && 'bg-panel2 text-ink')} title="Settings" aria-label="Settings"><Settings size={16} /></NavLink>
        </div>
      </aside>

      <main className="glow relative min-w-0 flex-1">
        {/* ---------- phone top bar (compact title fades in on scroll) ---------- */}
        <div ref={topbar} className="sticky top-0 z-30 border-b border-transparent bg-bg/90 px-4 pt-[max(env(safe-area-inset-top),10px)] pb-2 backdrop-blur-xl transition-colors md:hidden" style={ui.compactTitle ? { borderColor: 'var(--line)' } : undefined}>
          <div className="relative flex h-10 items-center gap-1">
            <div className="relative flex min-w-0 flex-1 items-center">
              <Logo size={24} className={cx('shrink-0 text-ink transition-all duration-300', ui.compactTitle && 'scale-75 opacity-0')} />
              <span className={cx('absolute left-0 max-w-full truncate text-[17px] font-semibold transition-all duration-300', ui.compactTitle ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0')}>{ui.compactTitle}</span>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2"><FocusIsland /></div>
            <SyncDot />
            <NavLink to="/search" className="btn-ghost h-10 w-10 rounded-full p-0" aria-label="Search"><Search size={19} /></NavLink>
            <NavLink to="/inbox" className="btn-ghost relative h-10 w-10 rounded-full p-0" aria-label="Inbox">
              <Inbox size={19} />
              {!!inboxCount && <span className="absolute top-1 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white tnum">{inboxCount}</span>}
            </NavLink>
            <NavLink to="/settings" className="btn-ghost h-10 w-10 rounded-full p-0" aria-label="Settings"><Settings size={19} /></NavLink>
          </div>
        </div>

        {/* desktop: floating timer pill */}
        <div className="pointer-events-none fixed top-4 left-[calc(50%+128px)] z-30 hidden -translate-x-1/2 md:block"><div className="pointer-events-auto"><FocusIsland /></div></div>

        <div className="mx-auto max-w-4xl px-4 pt-5 pb-36 md:px-8 md:pt-10 md:pb-16">
          <ErrorBoundary key={loc.pathname}><Outlet /></ErrorBoundary>
        </div>

        {/* desktop capture */}
        <button onClick={() => ui.openCapture('todo')} title="Quick capture (N)" aria-label="Quick capture"
          className="fixed right-8 bottom-8 hidden h-14 w-14 place-items-center rounded-[20px] text-white transition hover:scale-105 active:scale-95 md:grid"
          style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 85%, white), var(--accent))', boxShadow: '0 14px 34px -10px var(--accent)' }}>
          <Plus size={26} className={cx('transition-transform duration-300', ui.capture.open && 'rotate-45')} />
        </button>
      </main>

      {/* ---------- phone floating dock ---------- */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden" aria-label="Main">
        <div className="glass pointer-events-auto relative mx-auto flex max-w-md items-center justify-between rounded-[28px] px-2 py-1.5" style={{ boxShadow: 'var(--float-shadow)' }}>
          {dock.box && dockKey && <span className="absolute rounded-[20px] bg-panel2 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ left: dock.box.left, width: dock.box.width, top: dock.box.top, height: dock.box.height }} />}
          {dockItems.map((it, i) => it ? (
            <NavLink key={it.to} ref={dock.set(it.to)} to={it.to} end={it.to === '/'}
              className={cx('relative flex h-[52px] w-[60px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors', dockKey === it.to ? 'text-ink' : 'text-faint')}>
              <span className="relative">
                <it.icon size={21} strokeWidth={dockKey === it.to ? 2.3 : 1.9} style={dockKey === it.to ? { color: 'var(--accent)' } : undefined} />
                {it.to === '/focus' && focusPhase !== 'idle' && <span className="pulse-dot absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-[var(--accent)]" />}
              </span>
              {it.label}
            </NavLink>
          ) : (
            <button key={`cap-${i}`} onClick={() => ui.openCapture('todo')} aria-label="Quick capture"
              className="relative grid h-[52px] w-[52px] place-items-center rounded-[19px] text-white transition active:scale-90"
              style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 85%, white), var(--accent))', boxShadow: '0 10px 22px -8px var(--accent), inset 0 1px 0 rgb(255 255 255 / 0.3)' }}>
              <Plus size={26} className={cx('transition-transform duration-300', ui.capture.open && 'rotate-45')} />
            </button>
          ))}
        </div>
      </nav>

      <Toasts />
      <QuickCapture />
      <CommandPalette />
      <TodoEditor id={ui.todoId} onClose={() => ui.openTodo(null)} />
      <NoteEditor id={ui.noteId} onClose={() => ui.openNote(null)} />
      <LockScreen />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useMatch } from 'react-router-dom';
import { CalendarDays, Inbox, LayoutGrid, LogOut, Moon, Plus, Search, Settings2, Sun, Sunrise } from 'lucide-react';
import { useStore } from '../lib/store';
import { boardIcon } from '../lib/icons';
import { api } from '../lib/api';
import { cx } from '../lib/utils';
import QuickCapture from './QuickCapture';
import { ErrorBoundary } from './ErrorBoundary';
import { Logo } from './Logo';
import { Toasts } from './Toasts';

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', next ? '#0b0b0f' : '#f7f7f9'));
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* private mode */ }
  };
  return { dark, toggle };
}

function SyncDot() {
  const pending = useStore((s) => s.queue.length);
  const error = useStore((s) => s.error);
  const syncing = useStore((s) => s.syncing);
  const color = error ? 'bg-red-500' : pending || syncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500';
  const label = error ?? (pending ? 'Saving…' : syncing ? 'Syncing…' : 'All changes saved');
  return (
    <button title={label} onClick={() => useStore.getState().sync(true)} className="flex items-center gap-2 text-xs text-mute">
      <span className={cx('h-2 w-2 rounded-full', color)} />
      <span className="hidden truncate md:inline">{label}</span>
    </button>
  );
}

export default function Layout() {
  const boards = useStore((s) => s.db.boards);
  const inboxCount = useStore((s) => s.db.todos.filter((t) => !t.board_id && t.status !== 'done').length + s.db.notes.filter((n) => !n.board_id && !n.person_id).length);
  const active = useMemo(() => boards.filter((b) => !b.archived).sort((a, b) => a.position - b.position), [boards]);
  const m = useMatch('/b/:id');
  const current = boards.find((b) => b.id === m?.params.id);
  const accent = current?.color ?? '#6366f1';
  const [capture, setCapture] = useState(false);
  const { dark, toggle } = useTheme();
  const loc = useLocation();

  useEffect(() => { document.documentElement.style.setProperty('--accent', accent); }, [accent]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes(tag) && !(e.target as HTMLElement).isContentEditable) {
        e.preventDefault(); setCapture(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nav = [
    { to: '/', icon: Sunrise, label: 'Today', end: true },
    { to: '/week', icon: CalendarDays, label: 'Week' },
    { to: '/inbox', icon: Inbox, label: 'Inbox', badge: inboxCount },
    { to: '/search', icon: Search, label: 'Search' },
  ];

  const logout = async () => { await useStore.getState().flush(); await api.logout(); location.reload(); };

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-panel/60 px-3 py-4 backdrop-blur md:flex">
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <Logo size={28} />
          <div className="font-semibold tracking-tight">Life OS</div>
        </div>
        <nav className="space-y-0.5">
          {nav.map(({ to, icon: I, label, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition', isActive ? 'bg-panel2 font-medium text-ink' : 'text-mute hover:bg-panel2/70 hover:text-ink')}>
              <I size={17} /> <span className="flex-1">{label}</span>
              {!!badge && <span className="chip bg-panel2 text-mute">{badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 mb-1 flex items-center px-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
          <span className="flex-1">Boards</span>
          <NavLink to="/boards" className="rounded-md p-1 hover:bg-panel2 hover:text-ink" title="Manage boards"><Settings2 size={14} /></NavLink>
        </div>
        <nav className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
          {active.map((b) => {
            const I = boardIcon(b.icon);
            return (
              <NavLink key={b.id} to={`/b/${b.id}`} className={({ isActive }) => cx('group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition', isActive ? 'bg-panel2 font-medium text-ink' : 'text-mute hover:bg-panel2/70 hover:text-ink')}>
                <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ background: `${b.color}22`, color: b.color }}><I size={14} /></span>
                <span className="truncate">{b.name}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-3 flex items-center gap-1 border-t border-line px-1 pt-3">
          <div className="min-w-0 flex-1 px-1"><SyncDot /></div>
          <button className="btn-ghost p-2" onClick={toggle} title="Toggle theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button className="btn-ghost p-2" onClick={logout} title="Log out"><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="glow relative min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-line/60 bg-bg/75 px-4 pt-[max(env(safe-area-inset-top),10px)] pb-2.5 backdrop-blur-xl md:hidden">
          <Logo size={24} />
          <div className="flex-1 font-semibold tracking-tight">Life OS</div>
          <SyncDot />
          <NavLink to="/inbox" className="btn-ghost relative p-2" aria-label="Inbox">
            <Inbox size={18} />
            {!!inboxCount && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[var(--accent)]" />}
          </NavLink>
          <button className="btn-ghost p-2" onClick={toggle} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="btn-ghost p-2" onClick={logout} aria-label="Log out"><LogOut size={18} /></button>
        </div>

        <div className="mx-auto max-w-4xl px-4 pt-4 pb-32 md:px-8 md:pt-8">
          <ErrorBoundary key={loc.pathname}><Outlet /></ErrorBoundary>
        </div>

        {/* Desktop floating capture */}
        <button onClick={() => setCapture(true)} title="Quick capture (N)"
          className="fixed right-8 bottom-8 hidden h-14 w-14 place-items-center rounded-2xl text-white shadow-xl transition hover:scale-105 active:scale-95 md:grid"
          style={{ background: 'var(--accent)', boxShadow: '0 12px 30px -8px var(--accent)' }}>
          <Plus size={26} />
        </button>
      </main>

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-panel/80 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-1.5 pb-1">
          {[nav[0], nav[1]].map(({ to, icon: I, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex w-16 flex-col items-center gap-0.5 py-1 text-[10px] font-medium', isActive ? 'text-[var(--accent)]' : 'text-mute')}>
              <I size={21} /> {label}
            </NavLink>
          ))}
          <button onClick={() => setCapture(true)} aria-label="Quick capture"
            className="-mt-5 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-xl transition active:scale-90"
            style={{ background: 'var(--accent)', boxShadow: '0 10px 24px -6px var(--accent)' }}>
            <Plus size={26} />
          </button>
          {[{ to: '/boards', icon: LayoutGrid, label: 'Boards' }, nav[3]].map(({ to, icon: I, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx('flex w-16 flex-col items-center gap-0.5 py-1 text-[10px] font-medium', isActive || (to === '/boards' && m) ? 'text-[var(--accent)]' : 'text-mute')}>
              <I size={21} /> {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Toasts />
      <QuickCapture open={capture} onClose={() => setCapture(false)} defaultBoard={current?.id ?? null} />
    </div>
  );
}

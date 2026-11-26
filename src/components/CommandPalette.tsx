import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckSquare, CornerDownLeft, FileText, Inbox, LayoutGrid, ListTodo, Moon, PenLine, Plus, Search, Settings, Sunrise, Timer, User } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { useTheme } from '../lib/theme';
import { useFocus } from '../lib/focus';
import { searchAll } from '../lib/search';
import { boardIcon } from '../lib/icons';
import { openFile } from '../lib/files';
import { tabsFor } from '../pages/BoardPage';
import { fileIcon } from '../tabs/FilesTab';
import { cx, stripHtml } from '../lib/utils';
import { Kbd } from './ui';

interface Item { id: string; group: string; icon: ReactNode; title: string; hint?: string; color?: string; run: () => void; keywords?: string }

export function CommandPalette() {
  const open = useUI((s) => s.palette);
  const setPalette = useUI((s) => s.setPalette);
  const db = useStore((s) => s.db);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(!useUI.getState().palette); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette]);
  useEffect(() => { if (open) { setQ(''); setActive(0); } }, [open]);

  const items = useMemo<Item[]>(() => {
    const close = () => setPalette(false);
    const go = (to: string) => () => { close(); nav(to); };
    const boards = db.boards.filter((b) => !b.archived).sort((a, b) => a.position - b.position);
    const actions: Item[] = [
      { id: 'a-todo', group: 'Actions', icon: <Plus size={16} />, title: 'New to-do', run: () => { close(); useUI.getState().openCapture('todo'); }, keywords: 'add task create capture' },
      { id: 'a-note', group: 'Actions', icon: <PenLine size={16} />, title: 'New note', run: () => { close(); useUI.getState().openCapture('note'); }, keywords: 'add write' },
      { id: 'a-focus', group: 'Actions', icon: <Timer size={16} />, title: useFocus.getState().phase === 'idle' ? 'Start a focus session' : 'Open focus timer', run: go('/focus'), keywords: 'pomodoro study timer' },
      { id: 'a-theme', group: 'Actions', icon: <Moon size={16} />, title: 'Toggle dark mode', run: () => { close(); useTheme.getState().toggle(); }, keywords: 'theme light dark appearance' },
      { id: 'g-today', group: 'Go to', icon: <Sunrise size={16} />, title: 'Today', run: go('/') },
      { id: 'g-week', group: 'Go to', icon: <CalendarDays size={16} />, title: 'Week', run: go('/week') },
      { id: 'g-inbox', group: 'Go to', icon: <Inbox size={16} />, title: 'Inbox', run: go('/inbox') },
      { id: 'g-boards', group: 'Go to', icon: <LayoutGrid size={16} />, title: 'Boards', run: go('/boards') },
      { id: 'g-focus', group: 'Go to', icon: <Timer size={16} />, title: 'Focus', run: go('/focus') },
      { id: 'g-settings', group: 'Go to', icon: <Settings size={16} />, title: 'Settings', run: go('/settings'), keywords: 'face id notifications preferences' },
      ...boards.flatMap((b) => {
        const I = boardIcon(b.icon);
        return [
          { id: `b-${b.id}`, group: 'Boards', icon: <I size={16} />, color: b.color, title: b.name, hint: b.role ?? undefined, run: go(`/b/${b.id}`) },
          ...tabsFor(b).slice(1).map((t) => ({ id: `b-${b.id}-${t.key}`, group: 'Boards', icon: <t.icon size={16} />, color: b.color, title: `${b.name} › ${t.label}`, run: go(`/b/${b.id}?tab=${t.key}`) })),
        ];
      }),
    ];
    const ql = q.trim().toLowerCase();
    const matched = ql ? actions.filter((a) => `${a.title} ${a.keywords ?? ''}`.toLowerCase().includes(ql)) : actions.filter((a) => a.group !== 'Boards' || !a.title.includes('›'));
    const r = searchAll(db, q, 6);
    if (!r) return matched;
    const bc = (id: string | null) => db.boards.find((b) => b.id === id);
    return [
      ...matched.slice(0, 8),
      ...r.todos.map((t) => ({ id: `t-${t.id}`, group: 'To-dos', icon: <ListTodo size={16} />, color: bc(t.board_id)?.color, title: t.title, hint: bc(t.board_id)?.name ?? 'Inbox', run: () => { close(); useUI.getState().openTodo(t.id); } })),
      ...r.notes.map((n) => ({ id: `n-${n.id}`, group: 'Notes', icon: <FileText size={16} />, color: bc(n.board_id)?.color, title: n.title || stripHtml(n.content).slice(0, 60) || 'Untitled', hint: bc(n.board_id)?.name ?? 'Inbox', run: () => { close(); useUI.getState().openNote(n.id); } })),
      ...r.checklists.map((c) => ({ id: `c-${c.id}`, group: 'Checklists', icon: <CheckSquare size={16} />, color: bc(c.board_id)?.color, title: c.title, hint: bc(c.board_id)?.name, run: go(`/b/${c.board_id}?tab=checklists`) })),
      ...r.files.map((f) => { const I = fileIcon(f); return { id: `f-${f.id}`, group: 'Files', icon: <I size={16} />, color: bc(f.board_id)?.color, title: f.name, hint: f.tags.map((t) => `#${t}`).join(' '), run: () => { close(); openFile(f); } }; }),
      ...r.pieces.map((p) => ({ id: `p-${p.id}`, group: 'Content', icon: <PenLine size={16} />, color: bc(p.board_id)?.color, title: p.title, hint: p.stage, run: go(`/b/${p.board_id}?tab=pipeline&piece=${p.id}`) })),
      ...r.people.map((p) => ({ id: `pe-${p.id}`, group: 'People', icon: <User size={16} />, color: bc(p.board_id)?.color, title: p.name, hint: p.relation ?? undefined, run: go(`/b/${p.board_id}?tab=people&person=${p.id}`) })),
    ];
  }, [q, db, nav, setPalette]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);
  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[active]?.run(); }
    else if (e.key === 'Escape') setPalette(false);
  };

  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12vh]" onKeyDown={onKey}>
      <div className="fade-enter absolute inset-0 bg-black/40 backdrop-blur-[3px]" onClick={() => setPalette(false)} />
      <div className="pop-in glass relative w-full max-w-xl overflow-hidden rounded-[24px]" style={{ boxShadow: 'var(--float-shadow)' }} role="dialog" aria-label="Command palette">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-faint" />
          <input ref={input} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or jump to…" aria-label="Command"
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint" />
          <Kbd>esc</Kbd>
        </div>
        <div ref={list} className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 && <div className="px-3 py-10 text-center text-sm text-mute">No matches for “{q}”</div>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? (lastGroup = it.group) : null;
            return (
              <div key={it.id}>
                {head && <div className="eyebrow px-3 pt-3 pb-1.5 text-[10px]">{head}</div>}
                <button data-i={i} onMouseMove={() => setActive(i)} onClick={it.run}
                  className={cx('flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-sm transition-colors', i === active ? 'bg-panel2' : '')}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px]" style={{ background: it.color ? `${it.color}1f` : 'var(--panel2)', color: it.color ?? 'var(--mute)' }}>{it.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{it.title}</span>
                  {it.hint && <span className="max-w-[40%] truncate text-xs text-faint">{it.hint}</span>}
                  {i === active && <CornerDownLeft size={14} className="text-faint" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-faint">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          <span className="ml-auto flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>K</Kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}

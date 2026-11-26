import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { removeWithUndo, toast } from '../lib/toast';
import { boardIcon, BOARD_ICONS, COLORS } from '../lib/icons';
import type { Board, BoardKind } from '../lib/types';
import { cx, maxPos } from '../lib/utils';
import { Field, Section, Segmented, Sheet } from '../components/ui';

const KIND_LABEL: Record<BoardKind, string> = { standard: 'Standard', academics: 'Academics', content: 'Content', personal: 'Personal' };

export function BoardEditor({ board, open, onClose }: { board: Board | null; open: boolean; onClose: () => void }) {
  const s = useStore();
  const [name, setName] = useState(board?.name ?? '');
  const [role, setRole] = useState(board?.role ?? '');
  const [color, setColor] = useState(board?.color ?? COLORS[0]);
  const [icon, setIcon] = useState(board?.icon ?? 'folder');
  const [kind, setKind] = useState<BoardKind>(board?.kind ?? 'standard');

  const save = () => {
    if (!name.trim()) return;
    if (board) s.update('boards', board.id, { name: name.trim(), role: role.trim() || null, color, icon });
    else s.insert('boards', { name: name.trim(), role: role.trim() || null, color, icon, kind, position: maxPos(s.db.boards) });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={board ? 'Edit board' : 'New board'}
      footer={<div className="flex gap-2">
        {board && <button className="btn-ghost text-red-500" onClick={() => { if (confirm(`Delete "${board.name}" and everything in it?`)) { removeWithUndo('boards', board.id, `Deleted ${board.name}`); onClose(); } }}><Trash2 size={16} /> Delete</button>}
        <div className="flex-1" />
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" style={{ background: color }} onClick={save}>Save</button>
      </div>}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${color}22`, color }}>
            {(() => { const I = boardIcon(icon); return <I size={22} />; })()}
          </div>
          <input className="input text-base font-medium" placeholder="Board name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!board} />
        </div>
        <Field label="Your role (optional)"><input className="input" placeholder="e.g. Founder" value={role} onChange={(e) => setRole(e.target.value)} /></Field>
        {!board && (
          <Field label="Type">
            <Segmented value={kind} onChange={setKind} size="sm" options={(Object.keys(KIND_LABEL) as BoardKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
            <div className="mt-1.5 text-xs text-mute">Standard = notes, checklists, to-dos, files. Others add their own modules.</div>
          </Field>
        )}
        <Field label="Colour">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={cx('h-8 w-8 rounded-full transition', color === c && 'ring-2 ring-offset-2 ring-offset-[var(--panel)]')} style={{ background: c, ['--tw-ring-color' as string]: c }} aria-label={c} />
            ))}
          </div>
        </Field>
        <Field label="Icon">
          <div className="grid grid-cols-8 gap-1.5">
            {Object.entries(BOARD_ICONS).map(([k, I]) => (
              <button key={k} onClick={() => setIcon(k)} className={cx('grid aspect-square place-items-center rounded-xl transition', icon === k ? 'text-white' : 'bg-panel2 text-mute hover:text-ink')} style={icon === k ? { background: color } : undefined}>
                <I size={17} />
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

export default function Boards() {
  const s = useStore();
  const { boards, todos, notes, files } = s.db;
  const sorted = useMemo(() => [...boards].sort((a, b) => a.position - b.position), [boards]);
  const active = sorted.filter((b) => !b.archived);
  const archived = sorted.filter((b) => b.archived);
  const [editing, setEditing] = useState<Board | null | 'new'>(null);

  const move = (b: Board, dir: -1 | 1) => {
    const i = active.indexOf(b), j = i + dir;
    if (j < 0 || j >= active.length) return;
    const other = active[j];
    // normalise positions then swap
    active.forEach((x, k) => x.position !== k && s.update('boards', x.id, { position: k }));
    s.update('boards', b.id, { position: j });
    s.update('boards', other.id, { position: i });
  };

  const counts = (id: string) => ({
    open: todos.filter((t) => t.board_id === id && t.status !== 'done' && !t.parent_id).length,
    notes: notes.filter((n) => n.board_id === id).length,
    files: files.filter((f) => f.board_id === id).length,
  });

  return (
    <div>
      <div className="mb-5 flex items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Boards</h1>
          <p className="text-sm text-mute">Each part of your life, in its own space.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> New</button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {active.map((b, i) => {
          const I = boardIcon(b.icon);
          const c = counts(b.id);
          return (
            <div key={b.id} className="card group relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-25 blur-2xl" style={{ background: b.color }} />
              <Link to={`/b/${b.id}`} className="relative flex items-center gap-3 p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${b.color}22`, color: b.color }}><I size={21} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{b.name}</div>
                  <div className="truncate text-xs text-mute">
                    {b.role ? `${b.role} · ` : ''}{c.open} open · {c.notes} notes · {c.files} files
                  </div>
                </div>
              </Link>
              <div className="relative flex border-t border-line/70 px-2 py-1 text-mute">
                <button className="btn-ghost p-1.5" disabled={i === 0} onClick={() => move(b, -1)} aria-label="Move up"><ChevronUp size={15} /></button>
                <button className="btn-ghost p-1.5" disabled={i === active.length - 1} onClick={() => move(b, 1)} aria-label="Move down"><ChevronDown size={15} /></button>
                <div className="flex-1" />
                <button className="btn-ghost p-1.5" onClick={() => setEditing(b)} aria-label="Edit"><Pencil size={15} /></button>
                <button className="btn-ghost p-1.5" onClick={() => { s.update('boards', b.id, { archived: true }); toast(`Archived ${b.name}`, { label: 'Undo', run: () => s.update('boards', b.id, { archived: false }) }); }} aria-label="Archive"><Archive size={15} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {archived.length > 0 && (
        <Section title="Archived" className="mt-8">
          <div className="card divide-y divide-line">
            {archived.map((b) => (
              <div key={b.id} className="row">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                <span className="flex-1 text-sm text-mute">{b.name}</span>
                <button className="btn-ghost p-1.5" onClick={() => s.update('boards', b.id, { archived: false })}><ArchiveRestore size={15} /> Restore</button>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-10 flex items-center justify-center gap-2 text-xs text-faint md:hidden">
        <span>Life OS</span><span>·</span>
        <button className="underline-offset-2 hover:text-ink hover:underline" onClick={async () => { await useStore.getState().flush(); await api.logout(); location.reload(); }}>Log out</button>
      </div>

      {editing && <BoardEditor key={editing === 'new' ? 'new' : editing.id} board={editing === 'new' ? null : editing} open onClose={() => setEditing(null)} />}
    </div>
  );
}

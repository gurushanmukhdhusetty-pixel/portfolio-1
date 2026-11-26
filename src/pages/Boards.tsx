import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { addDays } from 'date-fns';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { removeWithUndo, toast } from '../lib/toast';
import { boardIcon, BOARD_ICONS, COLORS } from '../lib/icons';
import { sortTodos } from '../lib/todos';
import type { Board, BoardKind } from '../lib/types';
import { cx, dueLabel, maxPos, toISO } from '../lib/utils';
import { Field, PageHeader, Ring, Section, Segmented, Sheet } from '../components/ui';

const KIND_LABEL: Record<BoardKind, string> = { standard: 'Standard', academics: 'Academics', content: 'Content', personal: 'Personal' };

export function BoardIconTile({ board, size = 44 }: { board: Pick<Board, 'icon' | 'color'>; size?: number }) {
  const I = boardIcon(board.icon);
  return (
    <div className="grid shrink-0 place-items-center text-white" style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `linear-gradient(145deg, color-mix(in srgb, ${board.color} 78%, white), ${board.color} 55%, color-mix(in srgb, ${board.color} 80%, black))`,
      boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.35), 0 8px 18px -8px ${board.color}`,
    }}>
      <I size={size * 0.46} strokeWidth={2} />
    </div>
  );
}

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
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <BoardIconTile board={{ icon, color }} size={52} />
          <input className="input text-base font-medium" placeholder="Board name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!board} />
        </div>
        <Field label="Your role (optional)"><input className="input" placeholder="e.g. Founder" value={role} onChange={(e) => setRole(e.target.value)} /></Field>
        {!board && (
          <Field label="Type">
            <Segmented value={kind} onChange={setKind} size="sm" options={(Object.keys(KIND_LABEL) as BoardKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
            <div className="mt-1.5 text-xs text-mute">Standard = notes, checklists, to-dos, files. The others add their own modules.</div>
          </Field>
        )}
        <Field label="Colour">
          <div className="flex flex-wrap gap-2.5">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={cx('h-8 w-8 rounded-full transition hover:scale-110', color === c && 'ring-2 ring-offset-2 ring-offset-[var(--panel)]')} style={{ background: c, ['--tw-ring-color' as string]: c }} aria-label={c} />
            ))}
          </div>
        </Field>
        <Field label="Icon">
          <div className="grid grid-cols-8 gap-1.5">
            {Object.entries(BOARD_ICONS).map(([k, I]) => (
              <button key={k} onClick={() => setIcon(k)} aria-label={k} className={cx('grid aspect-square place-items-center rounded-[12px] transition', icon === k ? 'text-white' : 'bg-panel2 text-mute hover:text-ink')} style={icon === k ? { background: color } : undefined}>
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
  const [edit, setEdit] = useState(false);
  const weekEnd = toISO(addDays(new Date(), 7));
  const weekAgo = addDays(new Date(), -7).toISOString();

  const move = (b: Board, dir: -1 | 1) => {
    const i = active.indexOf(b), j = i + dir;
    if (j < 0 || j >= active.length) return;
    active.forEach((x, k) => x.position !== k && s.update('boards', x.id, { position: k }));
    s.update('boards', b.id, { position: j });
    s.update('boards', active[j].id, { position: i });
  };

  const stats = (id: string) => {
    const mine = todos.filter((t) => t.board_id === id && !t.parent_id);
    const open = mine.filter((t) => t.status !== 'done');
    const dueSoon = open.filter((t) => t.due_date && t.due_date <= weekEnd);
    const doneWeek = mine.filter((t) => t.status === 'done' && (t.completed_at ?? '') >= weekAgo).length;
    return { open: open.length, next: [...open].sort(sortTodos)[0], progress: doneWeek + dueSoon.length ? doneWeek / (doneWeek + dueSoon.length) : 0, notes: notes.filter((n) => n.board_id === id).length, files: files.filter((f) => f.board_id === id).length };
  };

  return (
    <div>
      <PageHeader compact="Boards" title="Boards" eyebrow={`${active.length} spaces`} subtitle="Each part of your life, in its own space."
        right={<button className={cx('btn mb-1', edit ? 'btn-primary' : 'btn-soft')} onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {active.map((b, i) => {
          const st = stats(b.id);
          const nl = st.next ? dueLabel(st.next.due_date) : null;
          const tile = (
            <>
              <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 85% at 100% 0%, color-mix(in srgb, ${b.color} 20%, transparent), transparent 62%)` }} />
              <div className="relative flex items-start justify-between">
                <BoardIconTile board={b} />
                <Ring value={st.progress} size={34} stroke={3.5} color={b.color}>
                  <span className="text-[10px] font-semibold tnum">{st.open}</span>
                </Ring>
              </div>
              <div className="relative mt-auto pt-5">
                <div className="truncate text-[16px] font-semibold tracking-tight">{b.name}</div>
                <div className="truncate text-xs text-mute">{b.role ?? KIND_LABEL[b.kind]} · {st.open} open</div>
                <div className="mt-2.5 truncate border-t border-line/70 pt-2 text-[11px] text-mute">
                  {st.next ? <><span className="text-faint">Next </span>{st.next.title}{nl ? <span className={cx(nl.tone === 'overdue' && 'text-red-500')}> · {nl.text}</span> : ''}</> : <span className="text-faint">{st.notes} notes · {st.files} files</span>}
                </div>
              </div>
            </>
          );
          return (
            <div key={b.id} className={cx('rise relative', edit && 'wiggle')} style={{ animationDelay: `${i * 45}ms` }}>
              {edit ? (
                <div className="card relative flex min-h-[176px] flex-col overflow-hidden p-4">{tile}</div>
              ) : (
                <Link to={`/b/${b.id}`} className="card relative flex min-h-[176px] flex-col overflow-hidden p-4 transition duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]">{tile}</Link>
              )}
              {edit && (
                <div className="pop-in absolute inset-x-2 bottom-2 flex items-center justify-between rounded-[14px] bg-panel/95 p-1 shadow-lg backdrop-blur">
                  <button className="btn-ghost h-8 w-8 p-0" disabled={i === 0} onClick={() => move(b, -1)} aria-label="Move earlier"><ChevronLeft size={16} /></button>
                  <button className="btn-ghost h-8 w-8 p-0" onClick={() => setEditing(b)} aria-label="Edit"><Pencil size={15} /></button>
                  <button className="btn-ghost h-8 w-8 p-0" onClick={() => { s.update('boards', b.id, { archived: true }); toast(`Archived ${b.name}`, { label: 'Undo', run: () => s.update('boards', b.id, { archived: false }) }); }} aria-label="Archive"><Archive size={15} /></button>
                  <button className="btn-ghost h-8 w-8 p-0" disabled={i === active.length - 1} onClick={() => move(b, 1)} aria-label="Move later"><ChevronRight size={16} /></button>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => setEditing('new')} className="rise flex min-h-[176px] flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line text-sm text-mute transition hover:border-[var(--accent)] hover:text-ink">
          <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-panel2"><Plus size={20} /></span>
          New board
        </button>
      </div>

      {archived.length > 0 && (
        <Section title="Archived" className="mt-10">
          <div className="card divide-y divide-line overflow-hidden">
            {archived.map((b) => (
              <div key={b.id} className="row">
                <BoardIconTile board={b} size={28} />
                <span className="flex-1 text-sm text-mute">{b.name}</span>
                <button className="btn-ghost py-1.5 text-xs" onClick={() => s.update('boards', b.id, { archived: false })}><ArchiveRestore size={14} /> Restore</button>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-12 flex items-center justify-center gap-2 text-xs text-faint md:hidden">
        <span>Life OS</span><span>·</span>
        <button className="underline-offset-2 hover:text-ink hover:underline" onClick={async () => { await useStore.getState().flush(); await api.logout(); location.reload(); }}>Log out</button>
      </div>

      {editing && <BoardEditor key={editing === 'new' ? 'new' : editing.id} board={editing === 'new' ? null : editing} open onClose={() => setEditing(null)} />}
    </div>
  );
}

import { Pin, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '../lib/store';
import { removeWithUndo } from '../lib/toast';
import { cx } from '../lib/utils';
import { RichText } from './RichText';
import { Sheet } from './ui';

export function NoteEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const s = useStore();
  const note = s.db.notes.find((n) => n.id === id);
  if (!id || !note) return null;
  const boards = s.db.boards.filter((b) => !b.archived).sort((a, b) => a.position - b.position);
  const close = () => {
    if (!note.title.trim() && !note.content.replace(/<[^>]+>/g, '').trim()) s.remove('notes', note.id); // drop empty notes
    onClose();
  };
  return (
    <Sheet open onClose={close} wide
      title={
        <div className="flex items-center gap-2">
          {!note.person_id && (
            <select className="max-w-[60%] truncate rounded-lg bg-panel2 px-2 py-1 text-xs font-medium outline-none" value={note.board_id ?? ''} onChange={(e) => s.update('notes', note.id, { board_id: e.target.value || null })}>
              <option value="">Inbox</option>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <span className="text-xs font-normal text-faint">Edited {format(parseISO(note.updated_at), 'd MMM, HH:mm')}</span>
        </div>
      }
      footer={<div className="flex items-center gap-2">
        <button className="btn-ghost text-red-500" onClick={() => { removeWithUndo('notes', note.id, 'Note deleted'); onClose(); }}><Trash2 size={16} /> Delete</button>
        <div className="flex-1" />
        <button className={cx('btn-ghost', note.pinned && 'text-[var(--accent)]')} onClick={() => s.update('notes', note.id, { pinned: !note.pinned })}><Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} /> {note.pinned ? 'Pinned' : 'Pin'}</button>
        <button className="btn-primary" onClick={close}>Done</button>
      </div>}>
      <input className="mb-1 w-full bg-transparent text-xl font-semibold outline-none placeholder:text-faint" placeholder="Title" value={note.title} onChange={(e) => s.update('notes', note.id, { title: e.target.value })} autoFocus={!note.title} />
      <RichText key={note.id} value={note.content} onChange={(html) => s.update('notes', note.id, { content: html })} />
    </Sheet>
  );
}

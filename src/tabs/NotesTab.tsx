import { useMemo, useState } from 'react';
import { FileText, Pin, Plus } from 'lucide-react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useStore } from '../lib/store';
import type { Board, Note } from '../lib/types';
import { stripHtml } from '../lib/utils';
import { NoteEditor } from '../components/NoteEditor';
import { Empty, SearchInput } from '../components/ui';

export function NoteRow({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const text = stripHtml(note.content);
  return (
    <button onClick={onOpen} className="row w-full text-left">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {note.pinned && <Pin size={12} className="shrink-0 text-[var(--accent)]" fill="currentColor" />}
          <span className="truncate text-[15px] font-medium">{note.title || text.slice(0, 60) || 'Untitled'}</span>
        </div>
        {text && note.title && <div className="truncate text-sm text-mute">{text.slice(0, 140)}</div>}
      </div>
      <span className="shrink-0 text-[11px] text-faint">{formatDistanceToNowStrict(parseISO(note.updated_at))}</span>
    </button>
  );
}

export default function NotesTab({ board }: { board: Board }) {
  const all = useStore((s) => s.db.notes);
  const insert = useStore((s) => s.insert);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const notes = useMemo(() => {
    const ql = q.toLowerCase();
    return all
      .filter((n) => n.board_id === board.id && !n.person_id)
      .filter((n) => !ql || n.title.toLowerCase().includes(ql) || stripHtml(n.content).toLowerCase().includes(ql))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
  }, [all, board.id, q]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search notes" /></div>
        <button className="btn-primary" onClick={() => setOpen(insert('notes', { board_id: board.id }).id)}><Plus size={16} /> Note</button>
      </div>
      {notes.length ? (
        <div className="card divide-y divide-line overflow-hidden">{notes.map((n) => <NoteRow key={n.id} note={n} onOpen={() => setOpen(n.id)} />)}</div>
      ) : (
        <Empty icon={<FileText size={22} />} title={q ? 'No matching notes' : 'No notes yet'} hint={q ? undefined : 'Meeting notes, ideas, anything. Pin the important ones.'} />
      )}
      <NoteEditor id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

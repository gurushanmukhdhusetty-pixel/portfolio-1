import { useState } from 'react';
import { Inbox as InboxIcon } from 'lucide-react';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import { sortTodos } from '../lib/todos';
import { TodoItem } from '../components/TodoItem';
import { TodoEditor } from '../components/TodoEditor';
import { NoteEditor } from '../components/NoteEditor';
import { NoteRow } from '../tabs/NotesTab';
import { Empty, Section } from '../components/ui';

function MoveTo({ onPick }: { onPick: (boardId: string) => void }) {
  const boards = useStore((s) => s.db.boards).filter((b) => !b.archived).sort((a, b) => a.position - b.position);
  return (
    <select className="mr-2 w-[74px] shrink-0 rounded-lg bg-panel2 px-1.5 py-1 text-xs text-mute outline-none" value="" onChange={(e) => e.target.value && onPick(e.target.value)} onClick={(e) => e.stopPropagation()} aria-label="Move to board">
      <option value="">Move…</option>
      {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}

export default function Inbox() {
  const s = useStore();
  const [todo, setTodo] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const todos = s.db.todos.filter((t) => !t.board_id && !t.parent_id && t.status !== 'done').sort(sortTodos);
  const notes = s.db.notes.filter((n) => !n.board_id && !n.person_id).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const boardName = (id: string) => s.db.boards.find((b) => b.id === id)?.name;

  const moveTodo = (id: string, b: string) => {
    s.update('todos', id, { board_id: b });
    s.db.todos.filter((x) => x.parent_id === id).forEach((x) => s.update('todos', x.id, { board_id: b }));
    toast(`Moved to ${boardName(b)}`, { label: 'Undo', run: () => s.update('todos', id, { board_id: null }) });
  };

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight">Inbox</h1>
      <p className="mb-5 text-sm text-mute">Quick captures waiting for a home.</p>
      {!todos.length && !notes.length ? (
        <Empty icon={<InboxIcon size={22} />} title="Inbox zero" hint="Anything you capture with + without choosing a board lands here." />
      ) : (
        <>
          {todos.length > 0 && (
            <Section title={`To-dos · ${todos.length}`}>
              <div className="card divide-y divide-line overflow-hidden">
                {todos.map((t) => (
                  <div key={t.id} className="flex items-center">
                    <div className="min-w-0 flex-1"><TodoItem todo={t} onOpen={(x) => setTodo(x.id)} /></div>
                    <MoveTo onPick={(b) => moveTodo(t.id, b)} />
                  </div>
                ))}
              </div>
            </Section>
          )}
          {notes.length > 0 && (
            <Section title={`Notes · ${notes.length}`}>
              <div className="card divide-y divide-line overflow-hidden">
                {notes.map((n) => (
                  <div key={n.id} className="flex items-center">
                    <div className="min-w-0 flex-1"><NoteRow note={n} onOpen={() => setNote(n.id)} /></div>
                    <MoveTo onPick={(b) => { s.update('notes', n.id, { board_id: b }); toast(`Moved to ${boardName(b)}`, { label: 'Undo', run: () => s.update('notes', n.id, { board_id: null }) }); }} />
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
      <TodoEditor id={todo} onClose={() => setTodo(null)} />
      <NoteEditor id={note} onClose={() => setNote(null)} />
    </div>
  );
}

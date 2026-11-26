import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, FileText, ListTodo, PenLine, Search as SearchIcon, User } from 'lucide-react';
import { useStore } from '../lib/store';
import { stripHtml } from '../lib/utils';
import { openFile } from '../lib/files';
import { fileIcon } from '../tabs/FilesTab';
import { TodoEditor } from '../components/TodoEditor';
import { NoteEditor } from '../components/NoteEditor';
import { DueChip, Empty, SearchInput, Section } from '../components/ui';

function Hl({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/** Snippet around the first match. */
function snip(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, 100);
  const a = Math.max(0, i - 40);
  return (a ? '…' : '') + text.slice(a, i + q.length + 60);
}

export default function Search() {
  const db = useStore((s) => s.db);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [todo, setTodo] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const board = (id: string | null) => db.boards.find((b) => b.id === id);

  const r = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (ql.length < 2) return null;
    const has = (...xs: (string | null | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(ql));
    return {
      todos: db.todos.filter((t) => has(t.title, t.details)).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')).slice(0, 30),
      notes: db.notes.filter((n) => has(n.title, stripHtml(n.content))).slice(0, 30),
      checklists: db.checklists.filter((c) => has(c.title) || db.checklist_items.some((i) => i.checklist_id === c.id && has(i.text))).slice(0, 20),
      files: db.files.filter((f) => has(f.name, f.url, ...f.tags)).slice(0, 30),
      pieces: db.content_pieces.filter((p) => has(p.title, stripHtml(p.body))).slice(0, 20),
      people: db.people.filter((p) => has(p.name, p.relation)).slice(0, 20),
    };
  }, [db, q]);
  const total = r ? Object.values(r).reduce((n, l) => n + l.length, 0) : 0;

  const Row = ({ icon, color, title, sub, right, onClick }: { icon: ReactNode; color?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick: () => void }) => (
    <button className="row w-full text-left" onClick={onClick}>
      <span className="shrink-0" style={{ color: color ?? 'var(--mute)' }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{title}</span>
        {sub && <span className="block truncate text-xs text-mute">{sub}</span>}
      </span>
      {right}
    </button>
  );

  return (
    <div>
      <h1 className="mb-3 text-[26px] font-semibold tracking-tight">Search</h1>
      <div className="mb-5"><SearchInput value={q} onChange={setQ} placeholder="To-dos, notes, checklists, files…" autoFocus /></div>
      {!r ? (
        <Empty icon={<SearchIcon size={22} />} title="Search everything" hint="Across every board: to-dos, notes, checklists, files, links, content and people." />
      ) : total === 0 ? (
        <Empty title={`No results for "${q}"`} />
      ) : (
        <>
          {r.todos.length > 0 && <Section title={`To-dos · ${r.todos.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.todos.map((t) => <Row key={t.id} icon={<ListTodo size={17} />} color={board(t.board_id)?.color} onClick={() => setTodo(t.id)}
              title={<span className={t.status === 'done' ? 'text-faint line-through' : ''}><Hl text={t.title} q={q} /></span>} sub={board(t.board_id)?.name ?? 'Inbox'} right={t.status !== 'done' && <DueChip due={t.due_date} />} />)}
          </div></Section>}
          {r.notes.length > 0 && <Section title={`Notes · ${r.notes.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.notes.map((n) => <Row key={n.id} icon={<FileText size={17} />} color={board(n.board_id)?.color} onClick={() => setNote(n.id)}
              title={<Hl text={n.title || 'Untitled'} q={q} />} sub={<Hl text={snip(stripHtml(n.content), q)} q={q} />} />)}
          </div></Section>}
          {r.checklists.length > 0 && <Section title={`Checklists · ${r.checklists.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.checklists.map((c) => {
              const hit = db.checklist_items.find((i) => i.checklist_id === c.id && i.text.toLowerCase().includes(q.toLowerCase()));
              return <Row key={c.id} icon={<CheckSquare size={17} />} color={board(c.board_id)?.color} onClick={() => nav(`/b/${c.board_id}?tab=checklists`)}
                title={<Hl text={c.title} q={q} />} sub={hit ? <Hl text={hit.text} q={q} /> : board(c.board_id)?.name} />;
            })}
          </div></Section>}
          {r.files.length > 0 && <Section title={`Files & links · ${r.files.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.files.map((f) => { const I = fileIcon(f); return <Row key={f.id} icon={<I size={17} />} color={board(f.board_id)?.color} onClick={() => openFile(f)}
              title={<Hl text={f.name} q={q} />} sub={[board(f.board_id)?.name, ...f.tags.map((t) => `#${t}`)].join(' · ')} />; })}
          </div></Section>}
          {r.pieces.length > 0 && <Section title={`Content · ${r.pieces.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.pieces.map((p) => <Row key={p.id} icon={<PenLine size={17} />} color={board(p.board_id)?.color} onClick={() => nav(`/b/${p.board_id}?tab=pipeline&piece=${p.id}`)}
              title={<Hl text={p.title} q={q} />} sub={p.stage} />)}
          </div></Section>}
          {r.people.length > 0 && <Section title={`People · ${r.people.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.people.map((p) => <Row key={p.id} icon={<User size={17} />} color={board(p.board_id)?.color} onClick={() => nav(`/b/${p.board_id}?tab=people&person=${p.id}`)}
              title={<Hl text={p.name} q={q} />} sub={p.relation} />)}
          </div></Section>}
        </>
      )}
      <TodoEditor id={todo} onClose={() => setTodo(null)} />
      <NoteEditor id={note} onClose={() => setNote(null)} />
    </div>
  );
}

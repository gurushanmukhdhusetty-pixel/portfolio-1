import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, FileText, ListTodo, PenLine, Search as SearchIcon, User } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { countResults, searchAll } from '../lib/search';
import { stripHtml } from '../lib/utils';
import { openFile } from '../lib/files';
import { fileIcon } from '../tabs/FilesTab';
import { DueChip, Empty, PageHeader, SearchInput, Section } from '../components/ui';

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

function Row({ icon, color, title, sub, right, onClick }: { icon: ReactNode; color?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick: () => void }) {
  return (
    <button className="row w-full text-left" onClick={onClick}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]" style={{ background: color ? `${color}1f` : 'var(--panel2)', color: color ?? 'var(--mute)' }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{title}</span>
        {sub && <span className="block truncate text-xs text-mute">{sub}</span>}
      </span>
      {right}
    </button>
  );
}

export default function Search() {
  const db = useStore((s) => s.db);
  const { openTodo, openNote } = useUI();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const board = (id: string | null) => db.boards.find((b) => b.id === id);
  const r = useMemo(() => searchAll(db, q), [db, q]);
  const total = countResults(r);

  return (
    <div>
      <PageHeader compact="Search" title="Search" eyebrow="Everything, everywhere" />
      <div className="rise mb-6"><SearchInput value={q} onChange={setQ} placeholder="To-dos, notes, checklists, files…" autoFocus /></div>
      {!r ? (
        <Empty icon={<SearchIcon size={22} />} title="Search everything" hint="Across every board: to-dos, notes, checklists, files, links, content and people." />
      ) : total === 0 ? (
        <Empty icon={<SearchIcon size={22} />} title={`No results for “${q}”`} hint="Try a shorter word." />
      ) : (
        <div className="rise">
          {r.todos.length > 0 && <Section title={`To-dos · ${r.todos.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.todos.map((t) => <Row key={t.id} icon={<ListTodo size={16} />} color={board(t.board_id)?.color} onClick={() => openTodo(t.id)}
              title={<span className={t.status === 'done' ? 'text-faint line-through' : ''}><Hl text={t.title} q={q} /></span>} sub={board(t.board_id)?.name ?? 'Inbox'} right={t.status !== 'done' && <DueChip due={t.due_date} />} />)}
          </div></Section>}
          {r.notes.length > 0 && <Section title={`Notes · ${r.notes.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.notes.map((n) => <Row key={n.id} icon={<FileText size={16} />} color={board(n.board_id)?.color} onClick={() => openNote(n.id)}
              title={<Hl text={n.title || 'Untitled'} q={q} />} sub={<Hl text={snip(stripHtml(n.content), q)} q={q} />} />)}
          </div></Section>}
          {r.checklists.length > 0 && <Section title={`Checklists · ${r.checklists.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.checklists.map((c) => {
              const hit = db.checklist_items.find((i) => i.checklist_id === c.id && i.text.toLowerCase().includes(q.toLowerCase()));
              return <Row key={c.id} icon={<CheckSquare size={16} />} color={board(c.board_id)?.color} onClick={() => nav(`/b/${c.board_id}?tab=checklists`)}
                title={<Hl text={c.title} q={q} />} sub={hit ? <Hl text={hit.text} q={q} /> : board(c.board_id)?.name} />;
            })}
          </div></Section>}
          {r.files.length > 0 && <Section title={`Files & links · ${r.files.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.files.map((f) => { const I = fileIcon(f); return <Row key={f.id} icon={<I size={16} />} color={board(f.board_id)?.color} onClick={() => openFile(f)}
              title={<Hl text={f.name} q={q} />} sub={[board(f.board_id)?.name, ...f.tags.map((t) => `#${t}`)].join(' · ')} />; })}
          </div></Section>}
          {r.pieces.length > 0 && <Section title={`Content · ${r.pieces.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.pieces.map((p) => <Row key={p.id} icon={<PenLine size={16} />} color={board(p.board_id)?.color} onClick={() => nav(`/b/${p.board_id}?tab=pipeline&piece=${p.id}`)}
              title={<Hl text={p.title} q={q} />} sub={p.stage} />)}
          </div></Section>}
          {r.people.length > 0 && <Section title={`People · ${r.people.length}`}><div className="card divide-y divide-line overflow-hidden">
            {r.people.map((p) => <Row key={p.id} icon={<User size={16} />} color={board(p.board_id)?.color} onClick={() => nav(`/b/${p.board_id}?tab=people&person=${p.id}`)}
              title={<Hl text={p.name} q={q} />} sub={p.relation} />)}
          </div></Section>}
        </div>
      )}
    </div>
  );
}

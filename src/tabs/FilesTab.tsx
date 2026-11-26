import { useMemo, useRef, useState } from 'react';
import { File as FileIcon, FileImage, FileText, Files, Link2, ListTodo, Plus, Tag, Trash2, Upload } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import { deleteFileRow, openFile, uploadFiles } from '../lib/files';
import type { Board, FileRow } from '../lib/types';
import { cx, fmtSize } from '../lib/utils';
import { Empty, Field, SearchInput, Sheet } from '../components/ui';

export function fileIcon(f: FileRow) {
  if (f.kind === 'link') return Link2;
  if (f.mime?.startsWith('image/')) return FileImage;
  if (f.mime === 'application/pdf' || f.mime?.includes('document') || f.mime?.startsWith('text/')) return FileText;
  return FileIcon;
}

function FileDetails({ file, onClose }: { file: FileRow; onClose: () => void }) {
  const s = useStore();
  const [tag, setTag] = useState('');
  const todos = s.db.todos.filter((t) => t.board_id === file.board_id && !t.parent_id && t.status !== 'done');
  const addTag = () => {
    const t = tag.trim().toLowerCase().replace(/^#/, '');
    if (t && !file.tags.includes(t)) s.update('files', file.id, { tags: [...file.tags, t] });
    setTag('');
  };
  return (
    <Sheet open onClose={onClose} title={file.kind === 'link' ? 'Link' : 'File'}
      footer={<div className="flex gap-2">
        <button className="btn-ghost text-red-500" onClick={() => { deleteFileRow(file); onClose(); }}><Trash2 size={16} /> Delete</button>
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => openFile(file)}>Open</button>
      </div>}>
      <div className="space-y-4">
        <Field label="Name"><input className="input" value={file.name} onChange={(e) => s.update('files', file.id, { name: e.target.value })} /></Field>
        {file.kind === 'link' && <Field label="URL"><input className="input" value={file.url ?? ''} onChange={(e) => s.update('files', file.id, { url: e.target.value })} /></Field>}
        <Field label="Tags">
          <div className="flex flex-wrap items-center gap-1.5">
            {file.tags.map((t) => (
              <button key={t} className="chip bg-panel2 text-ink hover:bg-red-500/15 hover:text-red-500" onClick={() => s.update('files', file.id, { tags: file.tags.filter((x) => x !== t) })}>#{t} ×</button>
            ))}
            <input className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" placeholder="Add tag + Enter" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} onBlur={addTag} />
          </div>
        </Field>
        <Field label="Attached to to-do">
          <select className="input" value={file.todo_id ?? ''} onChange={(e) => s.update('files', file.id, { todo_id: e.target.value || null })}>
            <option value="">None</option>
            {todos.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Field>
        <div className="text-xs text-faint">Added {format(parseISO(file.created_at), 'd MMM yyyy')}{file.size ? ` · ${fmtSize(file.size)}` : ''}</div>
      </div>
    </Sheet>
  );
}

export default function FilesTab({ board }: { board: Board }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const all = useMemo(() => s.db.files.filter((f) => f.board_id === board.id), [s.db.files, board.id]);
  const tags = useMemo(() => [...new Set(all.flatMap((f) => f.tags))].sort(), [all]);
  const files = all
    .filter((f) => !tagFilter || f.tags.includes(tagFilter))
    .filter((f) => { const ql = q.toLowerCase(); return !ql || f.name.toLowerCase().includes(ql) || f.tags.some((t) => t.includes(ql)) || f.url?.toLowerCase().includes(ql); })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const upload = async (list: FileList | File[]) => {
    setBusy(true);
    try { const r = await uploadFiles(board.id, list, null, tagFilter ? [tagFilter] : []); toast(r.length === 1 ? `Uploaded ${r[0].name}` : `Uploaded ${r.length} files`); } catch (e) { toast(`Upload failed: ${(e as Error).message}`); }
    setBusy(false);
  };
  const saveLink = () => {
    if (!link?.url.trim()) return;
    let url = link.url.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    let name = link.name.trim();
    if (!name) { try { name = new URL(url).hostname.replace(/^www\./, ''); } catch { name = url; } }
    s.insert('files', { board_id: board.id, kind: 'link', name, url, tags: tagFilter ? [tagFilter] : [] });
    setLink(null);
  };
  const current = s.db.files.find((f) => f.id === open);

  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
      className={cx('rounded-2xl transition', drag && 'ring-2 ring-[var(--accent)] ring-offset-4 ring-offset-[var(--bg)]')}>
      <div className="mb-3 flex gap-2">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search files & links" /></div>
        <button className="btn-ghost border border-line" aria-label="Add link" onClick={() => setLink({ name: '', url: '' })}><Link2 size={16} /><span className="hidden sm:inline">Link</span></button>
        <button className="btn-primary" aria-label="Upload files" disabled={busy} onClick={() => ref.current?.click()}><Upload size={16} />{busy ? '…' : <span className="hidden sm:inline">Upload</span>}</button>
        <input ref={ref} type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ''; }} />
      </div>
      {tags.length > 0 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
          <button className={cx('chip shrink-0 px-2.5 py-1', !tagFilter ? 'bg-[var(--accent)] text-white' : 'bg-panel2 text-mute')} onClick={() => setTagFilter(null)}>All</button>
          {tags.map((t) => <button key={t} className={cx('chip shrink-0 px-2.5 py-1', tagFilter === t ? 'bg-[var(--accent)] text-white' : 'bg-panel2 text-mute')} onClick={() => setTagFilter(tagFilter === t ? null : t)}><Tag size={10} />{t}</button>)}
        </div>
      )}
      {files.length ? (
        <div className="card divide-y divide-line overflow-hidden">
          {files.map((f) => {
            const I = fileIcon(f);
            const todo = f.todo_id ? s.db.todos.find((t) => t.id === f.todo_id) : null;
            return (
              <div key={f.id} className="row cursor-pointer" onClick={() => setOpen(f.id)}>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${board.color}1f`, color: board.color }}><I size={17} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px]">{f.name}</div>
                  <div className="flex items-center gap-2 truncate text-[11px] text-mute">
                    {f.kind === 'link' ? <span className="truncate">{f.url}</span> : <span>{fmtSize(f.size)}</span>}
                    {todo && <span className="flex items-center gap-0.5"><ListTodo size={11} />{todo.title}</span>}
                    {f.tags.map((t) => <span key={t}>#{t}</span>)}
                  </div>
                </div>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); openFile(f); }}>Open</button>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty icon={<Files size={22} />} title={q || tagFilter ? 'No matches' : 'No files yet'} hint="Upload PDFs, images and docs, or save links. You can also drag files here."
          action={!q && !tagFilter && <button className="btn-primary" onClick={() => ref.current?.click()}><Plus size={16} /> Upload</button>} />
      )}

      <Sheet open={!!link} onClose={() => setLink(null)} title="Save a link" footer={<div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setLink(null)}>Cancel</button><button className="btn-primary" onClick={saveLink}>Save</button></div>}>
        <div className="space-y-3">
          <Field label="URL"><input className="input" autoFocus placeholder="https://…" value={link?.url ?? ''} onChange={(e) => setLink({ ...link!, url: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveLink()} /></Field>
          <Field label="Name (optional)"><input className="input" value={link?.name ?? ''} onChange={(e) => setLink({ ...link!, name: e.target.value })} /></Field>
        </div>
      </Sheet>
      {current && <FileDetails file={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

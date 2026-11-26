import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Link2, Paperclip, Plus, Star, Timer, Trash2, Upload, X } from 'lucide-react';
import { useFocus } from '../lib/focus';
import { useStore } from '../lib/store';
import { removeWithUndo, toast } from '../lib/toast';
import { toggleTodo, toggleTop3 } from '../lib/todos';
import { openFile, uploadFiles } from '../lib/files';
import type { Recurrence, Status, Todo } from '../lib/types';
import { cx, maxPos } from '../lib/utils';
import { CheckBox, Field, Segmented, Sheet, priorityColor } from './ui';

export function TodoEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const s = useStore();
  const nav = useNavigate();
  const todo = s.db.todos.find((t) => t.id === id);
  const [sub, setSub] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!id || !todo) return null;

  const up = (patch: Partial<Todo>) => s.update('todos', todo.id, patch);
  const subs = s.db.todos.filter((t) => t.parent_id === todo.id).sort((a, b) => a.position - b.position);
  const boards = s.db.boards.filter((b) => !b.archived).sort((a, b) => a.position - b.position);
  const board = boards.find((b) => b.id === todo.board_id);
  const goals = s.db.goals.filter((g) => g.board_id === todo.board_id);
  const attached = s.db.files.filter((f) => f.todo_id === todo.id);
  const attachable = s.db.files.filter((f) => f.board_id === todo.board_id && !f.todo_id);

  const addSub = () => {
    if (!sub.trim()) return;
    s.insert('todos', { board_id: todo.board_id, parent_id: todo.id, title: sub.trim(), position: maxPos(subs) });
    setSub('');
  };

  return (
    <Sheet open onClose={onClose} wide
      title={<div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: board?.color ?? 'var(--faint)' }} />{board?.name ?? 'Inbox'}</div>}
      footer={<div className="flex items-center gap-2">
        <button className="btn-ghost px-2.5 text-red-500" onClick={() => { removeWithUndo('todos', todo.id, 'To-do deleted'); onClose(); }} aria-label="Delete"><Trash2 size={16} /><span className="hidden sm:inline">Delete</span></button>
        <div className="flex-1" />
        {todo.status !== 'done' && (
          <button className="btn-ghost px-2.5" onClick={() => {
            const last = s.db.focus_sessions.filter((f) => f.todo_id === todo.id).sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
            const f = useFocus.getState();
            f.setTarget({ todoId: todo.id, boardId: todo.board_id, courseId: last?.course_id ?? null, label: todo.title });
            if (f.phase === 'idle') f.start();
            onClose();
            nav('/focus');
          }}><Timer size={16} /> Focus</button>
        )}
        {!todo.parent_id && (
          <button className={cx('btn-ghost', !!todo.top3 && 'text-amber-400')} onClick={() => { if (!toggleTop3(todo)) toast('Top 3 is full. Unpin one first.'); }}>
            <Star size={16} fill={todo.top3 ? 'currentColor' : 'none'} /> {todo.top3 ? 'In Top 3' : 'Top 3'}
          </button>
        )}
        <button className="btn-primary" onClick={onClose}>Done</button>
      </div>}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="pt-2.5"><CheckBox checked={todo.status === 'done'} onChange={() => toggleTodo(todo)} size={22} /></div>
          <textarea rows={1} className="w-full resize-none bg-transparent py-1.5 text-lg font-medium outline-none field-sizing-content" value={todo.title} onChange={(e) => up({ title: e.target.value })} placeholder="To-do" />
        </div>
        <textarea className="input min-h-[70px] text-sm field-sizing-content" placeholder="Details…" value={todo.details} onChange={(e) => up({ details: e.target.value })} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date">
            <div className="flex gap-1">
              <input type="date" className="input" value={todo.due_date ?? ''} onChange={(e) => up({ due_date: e.target.value || null })} />
              {todo.due_date && <button className="btn-ghost px-2" onClick={() => up({ due_date: null })} aria-label="Clear date"><X size={15} /></button>}
            </div>
          </Field>
          <Field label="Repeat">
            <select className="input" value={todo.recurrence} onChange={(e) => up({ recurrence: e.target.value as Recurrence })} disabled={!!todo.parent_id}>
              <option value="none">Never</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-4">
          <Field label="Priority">
            <Segmented value={String(todo.priority)} onChange={(v) => up({ priority: Number(v) as 1 | 2 | 3 })} size="sm"
              options={[1, 2, 3].map((p) => ({ value: String(p), label: <span style={{ color: todo.priority === p ? priorityColor(p as 1) : undefined }}>P{p}</span> }))} />
          </Field>
          <Field label="Status">
            <Segmented<Status> value={todo.status} onChange={(v) => v === 'done' ? (todo.status !== 'done' && toggleTodo(todo)) : up({ status: v, completed_at: null })} size="sm"
              options={[{ value: 'todo', label: 'To do' }, { value: 'doing', label: 'Doing' }, { value: 'done', label: 'Done' }]} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Board">
            <select className="input" value={todo.board_id ?? ''} onChange={(e) => up({ board_id: e.target.value || null, goal_id: null })}>
              <option value="">Inbox</option>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          {goals.length > 0 && !todo.parent_id && (
            <Field label="Goal">
              <select className="input" value={todo.goal_id ?? ''} onChange={(e) => up({ goal_id: e.target.value || null })}>
                <option value="">None</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </Field>
          )}
        </div>

        {!todo.parent_id && (
          <Field label={`Subtasks${subs.length ? ` · ${subs.filter((x) => x.status === 'done').length}/${subs.length}` : ''}`}>
            <div className="card divide-y divide-line overflow-hidden">
              {subs.map((x) => (
                <div key={x.id} className="flex items-center gap-2.5 px-3 py-2">
                  <CheckBox checked={x.status === 'done'} onChange={() => toggleTodo(x)} size={18} />
                  <input className={cx('min-w-0 flex-1 bg-transparent text-sm outline-none', x.status === 'done' && 'text-faint line-through')} value={x.title} onChange={(e) => s.update('todos', x.id, { title: e.target.value })} />
                  <button className="text-faint hover:text-red-500" onClick={() => s.remove('todos', x.id)} aria-label="Remove subtask"><X size={15} /></button>
                </div>
              ))}
              <div className="flex items-center gap-2.5 px-3 py-2">
                <Plus size={18} className="text-faint" />
                <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" placeholder="Add subtask" value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} onBlur={addSub} />
              </div>
            </div>
          </Field>
        )}

        {todo.board_id && (
          <Field label="Attachments">
            <div className="space-y-1.5">
              {attached.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-xl bg-panel2 px-3 py-2 text-sm">
                  {f.kind === 'link' ? <Link2 size={15} className="text-mute" /> : <FileText size={15} className="text-mute" />}
                  <button className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => openFile(f)}>{f.name}</button>
                  <button className="text-faint hover:text-ink" title="Detach" onClick={() => s.update('files', f.id, { todo_id: null })}><X size={15} /></button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost border border-dashed border-line" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Upload size={15} /> {busy ? 'Uploading…' : 'Upload'}
                </button>
                {attachable.length > 0 && (
                  <select className="input w-auto py-1.5 text-sm" value="" onChange={(e) => e.target.value && s.update('files', e.target.value, { todo_id: todo.id })}>
                    <option value="">Attach from board files…</option>
                    {attachable.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                )}
              </div>
              <input ref={fileRef} type="file" multiple hidden onChange={async (e) => {
                if (!e.target.files?.length) return;
                setBusy(true);
                try { await uploadFiles(todo.board_id!, e.target.files, todo.id); } catch (err) { toast(`Upload failed: ${(err as Error).message}`); }
                setBusy(false);
                e.target.value = '';
              }} />
            </div>
          </Field>
        )}
        {attached.length === 0 && !todo.board_id && <div className="flex items-center gap-1.5 text-xs text-faint"><Paperclip size={12} /> Move to a board to attach files.</div>}
      </div>
    </Sheet>
  );
}


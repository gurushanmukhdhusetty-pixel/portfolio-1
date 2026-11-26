import { useEffect, useRef, useState } from 'react';
import { addDays } from 'date-fns';
import { CalendarPlus, FileText, Inbox, ListTodo } from 'lucide-react';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import { boardIcon } from '../lib/icons';
import { cx, maxPos, toISO } from '../lib/utils';
import { DueChip, PriorityFlag, Segmented, Sheet } from './ui';

export default function QuickCapture({ open, onClose, defaultBoard }: { open: boolean; onClose: () => void; defaultBoard: string | null }) {
  const s = useStore();
  const [kind, setKind] = useState<'todo' | 'note'>('todo');
  const [text, setText] = useState('');
  const [board, setBoard] = useState<string | null>(defaultBoard);
  const [due, setDue] = useState('');
  const [p, setP] = useState<1 | 2 | 3>(2);
  const ref = useRef<HTMLTextAreaElement>(null);
  const boards = s.db.boards.filter((b) => !b.archived).sort((a, b) => a.position - b.position);

  useEffect(() => {
    if (open) { setBoard(defaultBoard); setText(''); setDue(''); setP(2); setTimeout(() => ref.current?.focus(), 60); }
  }, [open, defaultBoard]);

  const save = () => {
    const t = text.trim();
    if (!t) return;
    if (kind === 'todo') {
      s.insert('todos', { board_id: board, title: t, due_date: due || null, priority: p, position: maxPos(s.db.todos.filter((x) => x.board_id === board)) });
    } else {
      const [first, ...rest] = t.split('\n');
      s.insert('notes', { board_id: board, title: rest.length ? first : '', content: (rest.length ? rest : [first]).map((l) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('') });
    }
    const where = boards.find((b) => b.id === board)?.name ?? 'Inbox';
    toast(`${kind === 'todo' ? 'To-do' : 'Note'} added to ${where}`);
    setText('');
    onClose();
  };

  // keep focus (and the phone keyboard) in the text box while tapping chips
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const quickDates = [['Today', toISO(new Date())], ['Tomorrow', toISO(addDays(new Date(), 1))], ['Next week', toISO(addDays(new Date(), 7))]];

  return (
    <Sheet open={open} onClose={onClose}
      title={<Segmented value={kind} onChange={setKind} size="sm" options={[{ value: 'todo', label: <span className="flex items-center gap-1"><ListTodo size={13} />To-do</span> }, { value: 'note', label: <span className="flex items-center gap-1"><FileText size={13} />Note</span> }]} />}
      footer={<div className="flex items-center gap-2">
        <span className="hidden text-xs text-faint sm:inline">Enter to save{kind === 'note' ? ' · Shift+Enter for new line' : ''}</span>
        <div className="flex-1" />
        <button className="btn-primary px-5" disabled={!text.trim()} onClick={save}>Save</button>
      </div>}>
      <textarea ref={ref} rows={kind === 'note' ? 4 : 2} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }}
        placeholder={kind === 'todo' ? 'What needs doing?' : 'Jot it down…'}
        className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-faint" />

      {kind === 'todo' && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {quickDates.map(([label, iso]) => (
            <button key={label} onMouseDown={keep} onClick={() => setDue(due === iso ? '' : iso)} className={cx('chip px-2.5 py-1 text-xs', due === iso ? 'bg-[var(--accent)] text-white' : 'bg-panel2 text-mute hover:text-ink')}>{label}</button>
          ))}
          <label className="chip relative cursor-pointer bg-panel2 px-2.5 py-1 text-xs text-mute hover:text-ink">
            {due && !quickDates.some(([, d]) => d === due) ? <DueChip due={due} /> : <><CalendarPlus size={12} /> Pick</>}
            <input type="date" className="absolute inset-0 opacity-0" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <div className="flex-1" />
          {[1, 2, 3].map((n) => (
            <button key={n} onMouseDown={keep} onClick={() => setP(n as 1)} className={cx('rounded-lg p-1.5 transition', p === n ? 'bg-panel2' : 'opacity-40 hover:opacity-100')} aria-label={`Priority ${n}`}><PriorityFlag p={n as 1} /></button>
          ))}
        </div>
      )}

      <div className="mt-4 mb-1 text-xs font-medium text-mute">Save to</div>
      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 scrollbar-none">
        <button onMouseDown={keep} onClick={() => setBoard(null)} className={cx('chip shrink-0 px-3 py-1.5 text-xs', !board ? 'bg-ink text-bg' : 'bg-panel2 text-mute')}><Inbox size={12} /> Inbox</button>
        {boards.map((b) => {
          const I = boardIcon(b.icon);
          return (
            <button key={b.id} onMouseDown={keep} onClick={() => setBoard(b.id)} className={cx('chip shrink-0 px-3 py-1.5 text-xs transition', board === b.id ? 'text-white' : 'bg-panel2 text-mute')} style={board === b.id ? { background: b.color } : undefined}>
              <I size={12} /> {b.name}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

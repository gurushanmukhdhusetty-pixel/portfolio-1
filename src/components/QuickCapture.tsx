import { useEffect, useRef, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { addDays } from 'date-fns';
import { CalendarPlus, FileText, Inbox, ListTodo } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { toast } from '../lib/toast';
import { boardIcon } from '../lib/icons';
import { cx, maxPos, toISO } from '../lib/utils';
import { DueChip, PriorityFlag, Segmented, Sheet } from './ui';

export default function QuickCapture() {
  const s = useStore();
  const { capture, closeCapture } = useUI();
  const m = useMatch('/b/:id');
  const [kind, setKind] = useState<'todo' | 'note'>('todo');
  const [text, setText] = useState('');
  const [board, setBoard] = useState<string | null>(null);
  const [due, setDue] = useState('');
  const [p, setP] = useState<1 | 2 | 3>(2);
  const ref = useRef<HTMLTextAreaElement>(null);
  const boards = s.db.boards.filter((b) => !b.archived).sort((a, b) => a.position - b.position);

  useEffect(() => {
    if (!capture.open) return;
    setKind(capture.kind); setBoard(m?.params.id ?? null); setText(''); setDue(''); setP(2);
    setTimeout(() => ref.current?.focus(), 80);
  }, [capture.open, capture.kind, m?.params.id]);

  const save = () => {
    const t = text.trim();
    if (!t) return;
    if (kind === 'todo') {
      s.insert('todos', { board_id: board, title: t, due_date: due || null, priority: p, position: maxPos(s.db.todos.filter((x) => x.board_id === board)) });
    } else {
      const [first, ...rest] = t.split('\n');
      const esc = (l: string) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      s.insert('notes', { board_id: board, title: rest.length ? first : '', content: (rest.length ? rest : [first]).map((l) => `<p>${esc(l)}</p>`).join('') });
    }
    toast(`${kind === 'todo' ? 'To-do' : 'Note'} added to ${boards.find((b) => b.id === board)?.name ?? 'Inbox'}`);
    setText('');
    closeCapture();
  };

  // keep focus (and the phone keyboard) in the text box while tapping chips
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const quickDates = [['Today', toISO(new Date())], ['Tomorrow', toISO(addDays(new Date(), 1))], ['Next week', toISO(addDays(new Date(), 7))]];

  return (
    <Sheet open={capture.open} onClose={closeCapture}
      title={<Segmented value={kind} onChange={setKind} size="sm" options={[{ value: 'todo', label: <span className="flex items-center gap-1"><ListTodo size={13} />To-do</span> }, { value: 'note', label: <span className="flex items-center gap-1"><FileText size={13} />Note</span> }]} />}
      footer={<div className="flex items-center gap-2">
        <span className="hidden text-xs text-faint sm:inline">Enter to save{kind === 'note' ? ' · Shift+Enter for a new line' : ''}</span>
        <div className="flex-1" />
        <button className="btn-primary px-6" disabled={!text.trim()} onClick={save}>Save</button>
      </div>}>
      <textarea ref={ref} rows={kind === 'note' ? 4 : 2} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }}
        placeholder={kind === 'todo' ? 'What needs doing?' : 'Jot it down…'}
        className="w-full resize-none bg-transparent text-[19px] leading-snug outline-none placeholder:text-faint" />

      {kind === 'todo' && (<>
        <div className="-mx-5 mt-2 flex items-center gap-1.5 overflow-x-auto px-5 scrollbar-none">
          {quickDates.map(([label, iso]) => (
            <button key={label} onMouseDown={keep} onClick={() => setDue(due === iso ? '' : iso)} className={cx('chip shrink-0 px-3 py-1.5 text-xs transition', due === iso ? 'bg-[var(--accent)] text-white' : 'bg-panel2 text-mute hover:text-ink')}>{label}</button>
          ))}
          <label className="chip relative shrink-0 cursor-pointer bg-panel2 px-3 py-1.5 text-xs text-mute hover:text-ink">
            {due && !quickDates.some(([, d]) => d === due) ? <DueChip due={due} /> : <><CalendarPlus size={12} /> Pick</>}
            <input type="date" className="absolute inset-0 opacity-0" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Pick a date" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-mute">Priority</span>
          <div className="flex gap-1" onMouseDown={keep}>
            {[1, 2, 3].map((n) => (
              <button key={n} onMouseDown={keep} onClick={() => setP(n as 1)} aria-label={`Priority ${n}`}
                className={cx('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition', p === n ? 'bg-panel2 text-ink' : 'text-faint hover:text-ink')}>
                <PriorityFlag p={n as 1} /> P{n}
              </button>
            ))}
          </div>
        </div>
      </>)}

      <div className="eyebrow mt-5 mb-2 text-[10px]">Save to</div>
      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 scrollbar-none">
        <button onMouseDown={keep} onClick={() => setBoard(null)} className={cx('chip shrink-0 px-3 py-1.5 text-xs transition', !board ? 'bg-ink text-bg' : 'bg-panel2 text-mute')}><Inbox size={12} /> Inbox</button>
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

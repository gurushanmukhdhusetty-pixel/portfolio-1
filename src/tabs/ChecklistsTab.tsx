import { useMemo, useState } from 'react';
import { CheckSquare, ChevronDown, MoreHorizontal, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { removeWithUndo } from '../lib/toast';
import type { Board, Checklist } from '../lib/types';
import { cx, maxPos } from '../lib/utils';
import { CheckBox, Empty, ProgressBar } from '../components/ui';

function ChecklistCard({ list, color }: { list: Checklist; color: string }) {
  const s = useStore();
  const items = s.db.checklist_items.filter((i) => i.checklist_id === list.id).sort((a, b) => a.position - b.position);
  const done = items.filter((i) => i.done).length;
  const [text, setText] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const add = () => {
    if (!text.trim()) return;
    s.insert('checklist_items', { checklist_id: list.id, text: text.trim(), position: maxPos(items) });
    setText('');
  };
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button onClick={() => setCollapsed(!collapsed)} className="text-mute"><ChevronDown size={16} className={cx('transition', collapsed && '-rotate-90')} /></button>
        <input className="min-w-0 flex-1 bg-transparent font-medium outline-none" value={list.title} onChange={(e) => s.update('checklists', list.id, { title: e.target.value })} />
        <span className="text-xs text-mute">{done}/{items.length}</span>
        <div className="relative">
          <button className="btn-ghost p-1" onClick={() => setMenu(!menu)} aria-label="Checklist menu"><MoreHorizontal size={16} /></button>
          {menu && (
            <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-line bg-panel p-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
              <button className="btn-ghost w-full justify-start" onClick={() => { items.forEach((i) => i.done && s.update('checklist_items', i.id, { done: false })); setMenu(false); }}><RotateCcw size={14} /> Uncheck all</button>
              <button className="btn-ghost w-full justify-start text-red-500" onClick={() => removeWithUndo('checklists', list.id, 'Checklist deleted')}><Trash2 size={14} /> Delete list</button>
            </div>
          )}
        </div>
      </div>
      <div className="px-3 pb-2"><ProgressBar value={items.length ? (done / items.length) * 100 : 0} color={color} /></div>
      {!collapsed && (
        <div className="divide-y divide-line border-t border-line">
          {items.map((i) => (
            <div key={i.id} className="group flex items-center gap-2.5 px-3 py-2">
              <CheckBox checked={i.done} onChange={() => s.update('checklist_items', i.id, { done: !i.done })} size={18} color={color} />
              <input className={cx('min-w-0 flex-1 bg-transparent text-sm outline-none', i.done && 'text-faint line-through')} value={i.text} onChange={(e) => s.update('checklist_items', i.id, { text: e.target.value })} />
              <button className="text-faint opacity-60 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => removeWithUndo('checklist_items', i.id, 'Item removed')} aria-label="Remove item"><X size={15} /></button>
            </div>
          ))}
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Plus size={18} className="text-faint" />
            <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" placeholder="Add item" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChecklistsTab({ board }: { board: Board }) {
  const all = useStore((s) => s.db.checklists);
  const insert = useStore((s) => s.insert);
  const lists = useMemo(() => all.filter((c) => c.board_id === board.id).sort((a, b) => a.position - b.position), [all, board.id]);
  const [title, setTitle] = useState('');
  const add = () => {
    if (!title.trim()) return;
    insert('checklists', { board_id: board.id, title: title.trim(), position: maxPos(lists) });
    setTitle('');
  };
  return (
    <div>
      <div className="card mb-3 flex items-center gap-2 py-1 pr-1.5 pl-3">
        <Plus size={18} className="text-[var(--accent)]" />
        <input className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-faint" placeholder="New checklist, e.g. Pitch deck prep" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        {title && <button className="btn-primary px-2.5 py-1.5" onClick={add}>Create</button>}
      </div>
      {lists.length ? (
        <div className="grid gap-3 sm:grid-cols-2">{lists.map((l) => <ChecklistCard key={l.id} list={l} color={board.color} />)}</div>
      ) : (
        <Empty icon={<CheckSquare size={22} />} title="No checklists" hint="Reusable lists: packing, launch steps, meeting prep." />
      )}
    </div>
  );
}

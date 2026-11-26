import { useShallow } from 'zustand/react/shallow';
import { ListTree, Paperclip, Repeat, Star } from 'lucide-react';
import { useStore } from '../lib/store';
import { toggleTodo } from '../lib/todos';
import type { Todo } from '../lib/types';
import { cx } from '../lib/utils';
import { CheckBox, DueChip, PriorityFlag } from './ui';

export function TodoItem({ todo, onOpen, showBoard }: { todo: Todo; onOpen: (t: Todo) => void; showBoard?: boolean }) {
  const subs = useStore(useShallow((s) => s.db.todos.filter((x) => x.parent_id === todo.id)));
  const files = useStore((s) => s.db.files.filter((f) => f.todo_id === todo.id).length);
  const board = useStore((s) => (showBoard ? s.db.boards.find((b) => b.id === todo.board_id) : undefined));
  const done = todo.status === 'done';
  const subsDone = subs.filter((x) => x.status === 'done').length;

  return (
    <div className="row cursor-pointer" onClick={() => onOpen(todo)}>
      <CheckBox checked={done} onChange={() => toggleTodo(todo)} color={board?.color} />
      <div className="min-w-0 flex-1">
        <div className={cx('truncate text-[15px]', done && 'text-faint line-through')}>{todo.title}</div>
        {(showBoard || subs.length > 0 || files > 0 || todo.recurrence !== 'none' || todo.status === 'doing') && (
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-mute">
            {todo.status === 'doing' && <span className="chip bg-sky-500/15 text-sky-500">Doing</span>}
            {showBoard && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: board?.color ?? 'var(--faint)' }} />
                {board?.name ?? 'Inbox'}
              </span>
            )}
            {subs.length > 0 && <span className="flex items-center gap-0.5"><ListTree size={11} />{subsDone}/{subs.length}</span>}
            {files > 0 && <span className="flex items-center gap-0.5"><Paperclip size={11} />{files}</span>}
            {todo.recurrence !== 'none' && <Repeat size={11} />}
          </div>
        )}
      </div>
      {todo.top3 && !done && <Star size={14} className="text-amber-400" fill="currentColor" />}
      {!done && <DueChip due={todo.due_date} />}
      {!done && <PriorityFlag p={todo.priority} />}
    </div>
  );
}

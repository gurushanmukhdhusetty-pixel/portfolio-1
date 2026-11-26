import { useEffect, useState, type ComponentType } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { BookMarked, CalendarClock, CheckSquare, FileText, Files, Flame, Kanban, ListTodo, Pencil, Target, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { boardIcon } from '../lib/icons';
import type { Board } from '../lib/types';
import { cx } from '../lib/utils';
import { BoardEditor } from './Boards';
import TodosTab from '../tabs/TodosTab';
import NotesTab from '../tabs/NotesTab';
import ChecklistsTab from '../tabs/ChecklistsTab';
import FilesTab from '../tabs/FilesTab';
import GoalsTab from '../tabs/GoalsTab';
import CoursesTab from '../tabs/CoursesTab';
import AssessmentsTab from '../tabs/AssessmentsTab';
import PipelineTab from '../tabs/PipelineTab';
import PeopleTab from '../tabs/PeopleTab';
import HabitsTab from '../tabs/HabitsTab';

type Tab = { key: string; label: string; icon: ComponentType<{ size?: number }>; C: ComponentType<{ board: Board }> };
const CORE: Tab[] = [
  { key: 'todos', label: 'To-dos', icon: ListTodo, C: TodosTab },
  { key: 'notes', label: 'Notes', icon: FileText, C: NotesTab },
  { key: 'checklists', label: 'Checklists', icon: CheckSquare, C: ChecklistsTab },
  { key: 'files', label: 'Files', icon: Files, C: FilesTab },
];
const GOALS: Tab = { key: 'goals', label: 'Goals', icon: Target, C: GoalsTab };

export function tabsFor(b: Board): Tab[] {
  switch (b.kind) {
    case 'academics':
      return [CORE[0], { key: 'courses', label: 'Grades', icon: BookMarked, C: CoursesTab }, { key: 'assessments', label: 'Assessments', icon: CalendarClock, C: AssessmentsTab }, GOALS, ...CORE.slice(1)];
    case 'content':
      return [{ key: 'pipeline', label: 'Pipeline', icon: Kanban, C: PipelineTab }, CORE[0], GOALS, ...CORE.slice(1)];
    case 'personal':
      return [CORE[0], { key: 'habits', label: 'Habits', icon: Flame, C: HabitsTab }, { key: 'people', label: 'People', icon: Users, C: PeopleTab }, GOALS, ...CORE.slice(1)];
    default:
      return CORE;
  }
}

export default function BoardPage() {
  const { id } = useParams();
  const board = useStore((s) => s.db.boards.find((b) => b.id === id));
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  useEffect(() => { document.title = board ? `${board.name} · Life OS` : 'Life OS'; }, [board]);
  if (!board) return <Navigate to="/boards" replace />;

  const tabs = tabsFor(board);
  const tab = tabs.find((t) => t.key === params.get('tab')) ?? tabs[0];
  const I = boardIcon(board.icon);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-lg" style={{ background: board.color, color: 'white', boxShadow: `0 10px 24px -10px ${board.color}` }}><I size={22} /></div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{board.name}</h1>
          {board.role && <div className="text-sm text-mute">{board.role}</div>}
        </div>
        <button className="btn-ghost p-2" onClick={() => setEditing(true)} aria-label="Edit board"><Pencil size={16} /></button>
      </div>

      <div className="sticky top-[calc(max(env(safe-area-inset-top),10px)+46px)] z-20 -mx-4 mb-4 bg-bg/80 px-4 py-2 backdrop-blur-xl md:top-0 md:-mx-8 md:px-8">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setParams({ tab: t.key }, { replace: true })}
              className={cx('flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition', t.key === tab.key ? 'text-white shadow-md' : 'text-mute hover:bg-panel2 hover:text-ink')}
              style={t.key === tab.key ? { background: board.color } : undefined}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div key={tab.key} className="fade-enter"><tab.C board={board} /></div>
      {editing && <BoardEditor board={board} open onClose={() => setEditing(false)} />}
    </div>
  );
}

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { BookMarked, CalendarClock, CheckSquare, FileText, Files, Flame, Kanban, ListTodo, Pencil, Target, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Board } from '../lib/types';
import { cx, toISO } from '../lib/utils';
import { addDays } from 'date-fns';
import { BoardEditor, BoardIconTile } from './Boards';
import { useSlider } from '../components/ui';
import { useUI } from '../lib/ui';
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
  const db = useStore((s) => s.db);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const tabs = board ? tabsFor(board) : [];
  const tab = tabs.find((t) => t.key === params.get('tab')) ?? tabs[0];
  const slider = useSlider(tab?.key ?? '');
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => { document.title = board ? `${board.name} · Life OS` : 'Life OS'; return () => { document.title = 'Life OS'; }; }, [board]);
  // board name appears in the phone top bar once the header scrolls away
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = title.current;
    if (!el || !board) return;
    const io = new IntersectionObserver(([e]) => useUI.setState({ compactTitle: e.isIntersecting ? null : board.name }), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => { io.disconnect(); useUI.setState({ compactTitle: null }); };
  }, [board]);
  useEffect(() => {
    if (slider.box && strip.current) strip.current.scrollTo({ left: slider.box.left - 40, behavior: 'smooth' });
  }, [slider.box]);
  if (!board || !tab) return <Navigate to="/boards" replace />;

  const open = db.todos.filter((t) => t.board_id === board.id && !t.parent_id && t.status !== 'done');
  const soon = open.filter((t) => t.due_date && t.due_date <= toISO(addDays(new Date(), 7))).length;
  const stats = [
    [`${open.length}`, 'open'],
    [`${soon}`, 'due this week'],
    [`${db.notes.filter((n) => n.board_id === board.id && !n.person_id).length}`, 'notes'],
    [`${db.files.filter((f) => f.board_id === board.id).length}`, 'files'],
  ];

  return (
    <div>
      <div className="relative -mx-4 -mt-5 mb-1 overflow-hidden px-4 pt-6 pb-5 md:-mx-8 md:-mt-10 md:px-8 md:pt-12">
        <div className="aurora" style={{ ['--c1' as string]: board.color, ['--c2' as string]: `color-mix(in oklab, ${board.color} 55%, #ec4899)` }} />
        <div className="rise relative flex items-end gap-4">
          <BoardIconTile board={board} size={60} />
          <div className="min-w-0 flex-1 pb-0.5">
            <div className="eyebrow mb-1">{board.role ?? ({ academics: 'Mahindra University', content: 'Analytical writing', personal: 'Life', standard: 'Board' } as const)[board.kind]}</div>
            <h1 ref={title} className="display line-clamp-2 text-[36px] break-words sm:text-[44px]">{board.name}</h1>
          </div>
          <button className="btn-ghost mb-1 h-10 w-10 rounded-full p-0" onClick={() => setEditing(true)} aria-label="Edit board"><Pencil size={16} /></button>
        </div>
        <div className="rise relative mt-4 flex gap-4 text-sm" style={{ animationDelay: '60ms' }}>
          {stats.map(([n, l]) => (
            <div key={l} className="min-w-0"><span className="font-semibold tnum">{n}</span> <span className="text-mute">{l}</span></div>
          ))}
        </div>
      </div>

      <div className="sticky top-[var(--topbar-h,56px)] z-20 -mx-4 mb-5 bg-bg/90 px-4 py-2.5 backdrop-blur-xl md:top-0 md:-mx-8 md:px-8">
        <div ref={strip} className="relative flex gap-1 overflow-x-auto scrollbar-none">
          {slider.box && <span className="absolute rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ left: slider.box.left, width: slider.box.width, top: slider.box.top, height: slider.box.height, background: board.color, boxShadow: `0 6px 16px -6px ${board.color}` }} />}
          {tabs.map((t) => (
            <button key={t.key} ref={slider.set(t.key)} onClick={() => setParams({ tab: t.key }, { replace: true })}
              className={cx('relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors', t.key === tab.key ? 'text-white' : 'text-mute hover:text-ink')}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div key={tab.key} className="rise"><tab.C board={board} /></div>
      {editing && <BoardEditor board={board} open onClose={() => setEditing(false)} />}
    </div>
  );
}

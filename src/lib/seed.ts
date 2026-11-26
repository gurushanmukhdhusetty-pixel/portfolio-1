import { useStore } from './store';
import type { BoardKind } from './types';

const BOARDS: { name: string; kind: BoardKind; role?: string; color: string; icon: string }[] = [
  { name: 'Academics', kind: 'academics', color: '#3b82f6', icon: 'graduation-cap' },
  { name: 'Cinematy', kind: 'standard', role: 'Founder', color: '#f43f5e', icon: 'clapperboard' },
  { name: 'Morphius AI', kind: 'standard', role: 'Chief Strategy Officer', color: '#8b5cf6', icon: 'brain' },
  { name: 'Content', kind: 'content', color: '#f59e0b', icon: 'pen-line' },
  { name: 'Personal & Friends', kind: 'personal', color: '#10b981', icon: 'users' },
];

type C = [name: string, weight: number, items?: number, bestOf?: number];
const COURSES: { name: string; code?: string; components: C[] }[] = [
  { name: 'Strategic Management II', components: [['Quizzes', 30, 3], ['Group project', 20], ['End-term', 50]] },
  { name: 'MIS', code: 'SMCC2271', components: [['Quizzes (best 3 of 4)', 30, 4, 3], ['Final project', 30], ['Mid-term', 30], ['Class participation', 10]] },
  {
    name: 'Digital Marketing', code: 'SMCC2141',
    components: [['Surprise quizzes (best 3 of 4)', 15, 4, 3], ['Simulation', 15], ['Group assignments (best 2 of 3)', 20, 3, 2], ['Mid-term', 25], ['Final project: report', 15], ['Final project: viva', 10]],
  },
  { name: 'Ecommerce & Marketplaces 2', code: 'BBAD2104', components: [['In-class assignments', 30, 10], ['Mid-term', 30], ['Group project', 30], ['Peer review', 10]] },
];

/** First run on an empty database: create the 5 boards and the pre-weighted courses. */
export function seedIfEmpty() {
  const s = useStore.getState();
  if (s.db.boards.length) return;
  BOARDS.forEach((b, i) => {
    const board = s.insert('boards', { ...b, role: b.role ?? null, position: i });
    if (b.kind === 'academics') {
      COURSES.forEach((c, ci) => {
        const course = s.insert('courses', { board_id: board.id, name: c.name, code: c.code ?? null, position: ci });
        c.components.forEach(([name, weight, items = 1, bestOf], pi) =>
          s.insert('grade_components', {
            course_id: course.id, name, weight, item_count: items, best_of: bestOf ?? null,
            scores: Array(items).fill(null), position: pi,
          }),
        );
      });
    }
  });
}

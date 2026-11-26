export type ID = string;
interface Base { id: ID; created_at: string; updated_at: string }

export type BoardKind = 'standard' | 'academics' | 'content' | 'personal';
export interface Board extends Base { name: string; kind: BoardKind; role: string | null; color: string; icon: string; position: number; archived: boolean }
export interface Note extends Base { board_id: ID | null; person_id: ID | null; title: string; content: string; pinned: boolean }
export interface Checklist extends Base { board_id: ID; title: string; position: number }
export interface ChecklistItem extends Base { checklist_id: ID; text: string; done: boolean; position: number }
export interface Goal extends Base { board_id: ID; title: string; description: string; deadline: string | null }
export type Status = 'todo' | 'doing' | 'done';
export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export interface Todo extends Base {
  board_id: ID | null; parent_id: ID | null; goal_id: ID | null; title: string; details: string;
  due_date: string | null; priority: 1 | 2 | 3; status: Status; recurrence: Recurrence;
  top3: number | null; position: number; completed_at: string | null;
}
export interface FileRow extends Base {
  board_id: ID; todo_id: ID | null; kind: 'file' | 'link'; name: string; storage_path: string | null;
  url: string | null; mime: string | null; size: number | null; tags: string[];
}
export interface Course extends Base { board_id: ID; name: string; code: string | null; target: number; position: number }
export type Score = { score: number; max: number } | null;
export interface GradeComponent extends Base { course_id: ID; name: string; weight: number; item_count: number; best_of: number | null; scores: Score[]; position: number }
export type AssessmentType = 'quiz' | 'exam' | 'assignment' | 'project' | 'presentation' | 'other';
export interface Assessment extends Base { board_id: ID; course_id: ID | null; title: string; type: AssessmentType; due_at: string | null; done: boolean }
export type Stage = 'idea' | 'drafting' | 'published';
export interface ContentPiece extends Base { board_id: ID; title: string; format: 'post' | 'article' | 'carousel' | 'other'; stage: Stage; body: string; published_url: string | null; published_at: string | null; position: number }
export interface ContentClaim extends Base { piece_id: ID; claim: string; number: string | null; source_url: string | null; source_date: string | null }
export interface Person extends Base { board_id: ID; name: string; relation: string | null; birth_month: number | null; birth_day: number | null; birth_year: number | null }
export interface Habit extends Base { board_id: ID; name: string; archived: boolean; position: number }
export interface HabitLog extends Base { habit_id: ID; day: string }

export interface DB {
  boards: Board[]; notes: Note[]; checklists: Checklist[]; checklist_items: ChecklistItem[];
  goals: Goal[]; todos: Todo[]; files: FileRow[]; courses: Course[]; grade_components: GradeComponent[];
  assessments: Assessment[]; content_pieces: ContentPiece[]; content_claims: ContentClaim[];
  people: Person[]; habits: Habit[]; habit_logs: HabitLog[];
}
export type Table = keyof DB;
export type Row<T extends Table> = DB[T][number];

export const TABLES: Table[] = [
  'boards', 'notes', 'checklists', 'checklist_items', 'goals', 'todos', 'files', 'courses',
  'grade_components', 'assessments', 'content_pieces', 'content_claims', 'people', 'habits', 'habit_logs',
];
export const emptyDB = (): DB => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as DB;

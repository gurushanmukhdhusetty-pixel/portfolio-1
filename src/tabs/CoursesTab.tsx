import type { Board } from '../lib/types';
export default function CoursesTab({ board }: { board: Board }) {
  return <div className="card p-6 text-sm text-mute">CoursesTab for {board.name}, coming in a later phase.</div>;
}

import type { Board } from '../lib/types';
export default function PeopleTab({ board }: { board: Board }) {
  return <div className="card p-6 text-sm text-mute">PeopleTab for {board.name}, coming in a later phase.</div>;
}

import type { Board } from '../lib/types';
export default function GoalsTab({ board }: { board: Board }) {
  return <div className="card p-6 text-sm text-mute">GoalsTab for {board.name}, coming in a later phase.</div>;
}

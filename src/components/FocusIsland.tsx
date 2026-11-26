import { useLocation, useNavigate } from 'react-router-dom';
import { Coffee } from 'lucide-react';
import { elapsedOf, fmtClock, useFocus, useNowWhile } from '../lib/focus';
import { useStore } from '../lib/store';
import { cx } from '../lib/utils';
import { Ring } from './ui';

/** Dynamic-island style pill showing a live timer anywhere in the app. */
export function FocusIsland({ className }: { className?: string }) {
  const f = useFocus();
  const loc = useLocation();
  const nav = useNavigate();
  const boardColor = useStore((s) => s.db.boards.find((b) => b.id === f.boardId)?.color);
  const now = useNowWhile(f.phase !== 'idle' && f.running);
  if (f.phase === 'idle' || loc.pathname === '/focus') return null;
  const el = elapsedOf(f, now);
  const color = f.phase === 'break' ? '#34d399' : boardColor ?? '#a78bfa';
  return (
    <button onClick={() => nav('/focus')} aria-label="Open focus timer"
      className={cx('pop-in flex items-center gap-2 rounded-full bg-black py-1 pr-3.5 pl-1 text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition active:scale-95', className)}>
      <Ring value={el / f.duration} size={24} stroke={3} color={color} track="rgba(255,255,255,0.14)">
        {f.phase === 'break' && <Coffee size={10} />}
      </Ring>
      <span className="font-mono text-[13px] tnum">{fmtClock(f.duration - el)}</span>
      {!f.running ? <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Paused</span>
        : <span className="pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
    </button>
  );
}

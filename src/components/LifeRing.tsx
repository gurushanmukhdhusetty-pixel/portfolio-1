import { useEffect, useState, type ReactNode } from 'react';

export interface Segment { id: string; color: string; done: number; total: number; name: string }

const pt = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const [x0, y0] = pt(cx, cy, r, from), [x1, y1] = pt(cx, cy, r, to);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** The logo, alive: one arc per board, each filling with today's progress on that board. */
export function LifeRing({ segments, size = 184, children }: { segments: Segment[]; size?: number; children?: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, []);
  const n = Math.max(1, segments.length);
  const r = 80, w = 15, gap = n > 1 ? 13 : 22;
  const cap = ((w / 2) / r) * (180 / Math.PI);
  const span = (360 - n * gap) / n;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} className="overflow-visible">
        {segments.map((s, i) => {
          const start = i * (span + gap) + gap / 2 + cap, end = start + span - 2 * cap;
          const d = arc(100, 100, r, start, end);
          const pct = s.total ? s.done / s.total : 0;
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={s.color} strokeOpacity={s.total ? 0.2 : 0.1} strokeWidth={w} strokeLinecap="round" />
              <path d={d} fill="none" stroke={s.color} strokeWidth={w} strokeLinecap="round" pathLength={1}
                strokeDasharray={`${shown ? pct : 0} 1`} style={{ transition: `stroke-dasharray 1.1s cubic-bezier(0.16, 1, 0.3, 1) ${0.1 + i * 0.08}s`, opacity: pct > 0 ? 1 : 0, filter: pct >= 1 ? `drop-shadow(0 0 6px ${s.color})` : undefined }} />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

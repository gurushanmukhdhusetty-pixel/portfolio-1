import paths from './logo-paths.json';

/** Five life segments around you. Dot follows text colour so it works in light + dark. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-label="Life OS">
      {(paths as [string, string][]).map(([d, c]) => (
        <path key={c} d={d} stroke={c} strokeWidth={58} strokeLinecap="round" fill="none" />
      ))}
      <circle cx="256" cy="256" r="46" fill="currentColor" />
    </svg>
  );
}

/** The logo drawing itself: arcs sweep in one after another, then the dot lands. */
export function AnimatedLogo({ size = 72, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-label="Life OS">
      {(paths as [string, string][]).map(([d, c], i) => (
        <path key={c} d={d} stroke={c} strokeWidth={58} strokeLinecap="round" fill="none" pathLength={1} className="draw" style={{ animationDelay: `${0.08 + i * 0.09}s` }} />
      ))}
      <circle cx="256" cy="256" r="46" fill="currentColor" className="pop-in" style={{ animationDelay: '0.55s', transformOrigin: 'center', transformBox: 'fill-box' }} />
    </svg>
  );
}

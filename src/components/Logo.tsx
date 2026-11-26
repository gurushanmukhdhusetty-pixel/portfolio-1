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

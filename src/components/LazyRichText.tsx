import { lazy, Suspense, type ComponentProps } from 'react';

// The editor (TipTap) is the heaviest dependency; load it only when a note opens.
const Inner = lazy(() => import('./RichText').then((m) => ({ default: m.RichText })));

export function RichText(props: ComponentProps<typeof Inner>) {
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse py-3"><div className="h-4 w-2/3 rounded bg-panel2" /></div>}>
      <Inner {...props} />
    </Suspense>
  );
}

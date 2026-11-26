import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const read = (): ThemeMode => { try { return (localStorage.getItem('theme') as ThemeMode) || 'system'; } catch { return 'system'; } };
const isDark = (m: ThemeMode) => m === 'dark' || (m === 'system' && media().matches);

function paint(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', dark ? '#09090b' : '#f4f3ef'));
}

/** Switch theme with a circular reveal from the tap point (View Transitions), instant elsewhere. */
function transition(dark: boolean, origin?: { x: number; y: number }) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!doc.startViewTransition || reduce || dark === document.documentElement.classList.contains('dark')) return paint(dark);
  const { x, y } = origin ?? { x: innerWidth / 2, y: 0 };
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  doc.startViewTransition(() => paint(dark)).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
}

export const useTheme = create<{ mode: ThemeMode; dark: boolean; setMode: (m: ThemeMode, origin?: { x: number; y: number }) => void; toggle: (origin?: { x: number; y: number }) => void }>((set, get) => ({
  mode: read(),
  dark: isDark(read()),
  setMode(mode, origin) {
    try { localStorage.setItem('theme', mode); } catch { /* private mode */ }
    const dark = isDark(mode);
    transition(dark, origin);
    set({ mode, dark });
  },
  toggle(origin) { get().setMode(get().dark ? 'light' : 'dark', origin); },
}));

if (typeof window !== 'undefined') {
  media().addEventListener('change', () => {
    const { mode } = useTheme.getState();
    if (mode === 'system') { paint(media().matches); useTheme.setState({ dark: media().matches }); }
  });
}

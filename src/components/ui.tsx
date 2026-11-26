import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Flag, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cx, dueLabel } from '../lib/utils';
import { useUI } from '../lib/ui';

const isPhone = () => typeof window !== 'undefined' && !window.matchMedia('(min-width: 640px)').matches;

/**
 * Bottom sheet on phones (swipe down to dismiss), centred dialog on larger screens.
 * Dismissals by the user (swipe, backdrop, ×, Esc) animate out.
 */
export function Sheet({ open, onClose, title, children, wide, footer }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; t0: number; dy: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => { setLeaving(false); closeRef.current(); }, 190);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, dismiss]);

  if (!open) return null;

  const down = (e: React.PointerEvent) => {
    if (!isPhone() || (e.target as HTMLElement).closest('button,input,select,textarea,a')) return;
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !panel.current) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    panel.current.style.transition = 'none';
    panel.current.style.transform = `translateY(${d.dy}px)`;
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !panel.current) return;
    const v = d.dy / Math.max(1, performance.now() - d.t0);
    panel.current.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
    if (d.dy > 110 || v > 0.55) {
      panel.current.style.transform = 'translateY(100%)';
      setTimeout(() => closeRef.current(), 200);
    } else panel.current.style.transform = '';
  };

  // portal: sheets must never be trapped inside an animated/transformed ancestor
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className={cx('absolute inset-0 bg-black/45 backdrop-blur-[3px]', leaving ? 'fade-exit' : 'fade-enter')} onClick={dismiss} />
      <div ref={panel}
        className={cx('relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border border-line bg-panel sm:rounded-[28px]', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg', leaving ? 'sheet-exit' : 'sheet-enter')}
        style={{ boxShadow: 'var(--float-shadow)' }}>
        <div className="touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-line sm:hidden" />
          <div className="flex min-h-12 items-center gap-2 px-5 pt-2 pb-1 sm:pt-4">
            <div className="min-w-0 flex-1 text-base font-semibold">{title}</div>
            <button className="btn-ghost -mr-2 h-9 w-9 rounded-full p-0" onClick={dismiss} aria-label="Close"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-5">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Round checkbox: fills, draws the tick and throws a few sparks. */
export function CheckBox({ checked, onChange, color, size = 22 }: { checked: boolean; onChange: () => void; color?: string; size?: number }) {
  const [burst, setBurst] = useState(0);
  const c = color ?? 'var(--accent)';
  return (
    <button type="button" aria-label={checked ? 'Mark not done' : 'Mark done'}
      onClick={(e) => { e.stopPropagation(); if (!checked) setBurst((b) => b + 1); onChange(); }}
      className={cx('group/cb relative grid shrink-0 place-items-center rounded-full transition active:scale-90', checked && 'cb-on')}
      style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="overflow-visible">
        <circle cx="12" cy="12" r="10.5" fill="none" stroke={checked ? 'transparent' : 'currentColor'} strokeWidth="1.8" className="text-faint/80 transition-colors group-hover/cb:text-[var(--accent)]" />
        <circle cx="12" cy="12" r="11.5" fill={c} className="cb-fill" style={{ transform: checked ? 'scale(1)' : 'scale(0)', opacity: checked ? 1 : 0 }} />
        <path d="M7.5 12.4l3 3 6-6.4" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="cb-tick" />
      </svg>
      {burst > 0 && (
        <span key={burst} className="pointer-events-none absolute inset-0" aria-hidden>
          {[0, 60, 120, 180, 240, 300].map((a) => <span key={a} className="spark" style={{ ['--a' as string]: `${a + 15}deg`, ['--c' as string]: c }} />)}
        </span>
      )}
    </button>
  );
}

const P_COLORS = { 1: '#ef4444', 2: '#f59e0b', 3: '#60a5fa' } as const;
export function PriorityFlag({ p }: { p: 1 | 2 | 3 }) {
  return <Flag size={13} style={{ color: P_COLORS[p] }} fill={p === 1 ? P_COLORS[p] : 'none'} aria-label={`Priority ${p}`} />;
}
export const priorityColor = (p: 1 | 2 | 3) => P_COLORS[p];

export function DueChip({ due }: { due: string | null }) {
  const l = dueLabel(due);
  if (!l) return null;
  const tone = {
    overdue: 'bg-red-500/12 text-red-500',
    today: 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]',
    soon: 'bg-panel2 text-ink',
    later: 'bg-panel2 text-mute',
  }[l.tone];
  return <span className={cx('chip tnum', tone)}>{l.text}</span>;
}

/** Empty state with a quiet version of the ring motif. */
export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rise flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="relative mb-2 grid h-16 w-16 place-items-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 text-line" aria-hidden>
          <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="14 6.5" strokeLinecap="round" />
        </svg>
        <div className="text-mute">{icon}</div>
      </div>
      <div className="font-medium">{title}</div>
      {hint && <div className="max-w-xs text-sm text-mute">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Measures the active item so a pill can slide to it. */
export function useSlider(active: string) {
  const refs = useRef(new Map<string, HTMLElement>());
  const [box, setBox] = useState<{ left: number; width: number; top: number; height: number } | null>(null);
  const measure = useCallback(() => {
    const el = refs.current.get(active);
    if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth, top: el.offsetTop, height: el.offsetHeight });
  }, [active]);
  useLayoutEffect(() => {
    measure();
    const el = refs.current.get(active);
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, measure]);
  const set = (k: string) => (el: HTMLElement | null) => { if (el) refs.current.set(k, el); else refs.current.delete(k); };
  return { set, box };
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[]; size?: 'sm' | 'md';
}) {
  const { set, box } = useSlider(value);
  return (
    <div className="relative inline-flex rounded-[13px] bg-panel2 p-[3px]">
      {box && <span className="absolute rounded-[10px] bg-panel shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-[#2a2a31]" style={{ left: box.left, width: box.width, top: box.top, height: box.height }} />}
      {options.map((o) => (
        <button key={o.value} ref={set(o.value)} type="button" onClick={() => onChange(o.value)} aria-label={o.title} title={o.title} aria-pressed={value === o.value}
          className={cx('relative rounded-[10px] font-medium transition-colors', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm', value === o.value ? 'text-ink' : 'text-mute hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cx('relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40', on ? '' : 'bg-line')}
      style={on ? { background: 'var(--accent)' } : undefined}>
      <span className={cx('absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(0.22,1.2,0.36,1)]', on && 'translate-x-5')} />
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-mute">{label}</div>
      {children}
    </label>
  );
}

export function Section({ title, right, children, className }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('mb-7', className)}>
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <h2 className="eyebrow flex-1">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2">
      <div className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ?? 'var(--accent)' }} />
    </div>
  );
}

/** Progress ring; animates from 0 on mount. */
export function Ring({ value, size = 44, stroke = 5, color, track = 'var(--panel2)', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const [v, setV] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setV(Math.max(0, Math.min(1, value)))); return () => cancelAnimationFrame(id); }, [value]);
  const r = (size - stroke) / 2;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color ?? 'var(--accent)'} strokeWidth={stroke} strokeLinecap="round"
          pathLength={1} strokeDasharray={`${v} 1`} style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.16, 1, 0.3, 1)', opacity: v > 0 ? 1 : 0 }} />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <svg className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input className="input pl-10" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} type="search" />
    </div>
  );
}

/** Large editorial title that hands off to the compact top bar when scrolled away (iOS style). */
export function PageHeader({ title, compact, eyebrow, subtitle, right }: { title: ReactNode; compact: string; eyebrow?: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => useUI.setState({ compactTitle: e.isIntersecting ? null : compact }), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => { io.disconnect(); useUI.setState({ compactTitle: null }); };
  }, [compact]);
  return (
    <header className="rise mb-6 flex items-end gap-3">
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 ref={ref} className="display text-[40px] sm:text-[46px]">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-mute">{subtitle}</div>}
      </div>
      {right}
    </header>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-panel2 px-1.5 py-0.5 font-mono text-[10px] text-mute">{children}</kbd>;
}


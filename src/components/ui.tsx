import { useEffect, type ReactNode } from 'react';
import { Check, Flag, X } from 'lucide-react';
import { cx, dueLabel } from '../lib/utils';

export function Sheet({ open, onClose, title, children, wide, footer }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="fade-enter absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('sheet-enter relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-panel shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-center gap-2 px-5 pt-3 pb-2 sm:pt-5">
          <div className="min-w-0 flex-1 text-base font-semibold">{title}</div>
          <button className="btn-ghost -mr-2 p-2" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function CheckBox({ checked, onChange, color, size = 20 }: { checked: boolean; onChange: () => void; color?: string; size?: number }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={cx('grid shrink-0 place-items-center rounded-full border-2 transition', checked ? 'check-pop border-transparent text-white' : 'border-faint/70 hover:border-[var(--accent)]')}
      style={{ width: size, height: size, background: checked ? color ?? 'var(--accent)' : undefined }}
      aria-label={checked ? 'Mark not done' : 'Mark done'}
    >
      {checked && <Check size={size * 0.62} strokeWidth={3.5} />}
    </button>
  );
}

const P_COLORS = { 1: '#ef4444', 2: '#f59e0b', 3: '#60a5fa' } as const;
export function PriorityFlag({ p }: { p: 1 | 2 | 3 }) {
  return <Flag size={13} style={{ color: P_COLORS[p] }} fill={p === 1 ? P_COLORS[p] : 'none'} />;
}
export const priorityColor = (p: 1 | 2 | 3) => P_COLORS[p];

export function DueChip({ due }: { due: string | null }) {
  const l = dueLabel(due);
  if (!l) return null;
  const tone = { overdue: 'bg-red-500/12 text-red-500', today: 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]', soon: 'bg-panel2 text-ink', later: 'bg-panel2 text-mute' }[l.tone];
  return <span className={cx('chip', tone)}>{l.text}</span>;
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-panel2 text-mute">{icon}</div>}
      <div className="font-medium">{title}</div>
      {hint && <div className="max-w-xs text-sm text-mute">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-xl bg-panel2 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('rounded-[10px] font-medium transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm', value === o.value ? 'bg-panel text-ink shadow-sm' : 'text-mute hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-mute">{label}</div>
      {children}
    </label>
  );
}

export function Section({ title, right, children, className }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('mb-6', className)}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <h2 className="flex-1 text-xs font-semibold uppercase tracking-wider text-mute">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ?? 'var(--accent)' }} />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <svg className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} type="search" />
    </div>
  );
}

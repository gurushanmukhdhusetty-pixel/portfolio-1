import { useToasts } from '../lib/toast';

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8">
      {toasts.map((t) => (
        <div key={t.id} className="sheet-enter pointer-events-auto flex min-w-[240px] max-w-sm items-center gap-3 rounded-2xl bg-ink py-2.5 pr-2 pl-4 text-sm text-bg shadow-2xl">
          <span className="flex-1">{t.text}</span>
          {t.action && (
            <button className="rounded-lg px-2.5 py-1 font-semibold text-[var(--accent)] brightness-125 hover:bg-white/10" onClick={() => { t.action!.run(); dismiss(t.id); }}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

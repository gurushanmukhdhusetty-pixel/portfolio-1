import { Check } from 'lucide-react';
import { useToasts } from '../lib/toast';

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+84px)] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-8" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pop-in pointer-events-auto flex min-w-[220px] max-w-sm items-center gap-2.5 rounded-full bg-black/90 py-2 pr-2 pl-2.5 text-sm text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/12"><Check size={13} /></span>
          <span className="flex-1 pr-2">{t.text}</span>
          {t.action && (
            <button className="rounded-full bg-white/12 px-3 py-1 text-[13px] font-semibold transition hover:bg-white/20" onClick={() => { t.action!.run(); dismiss(t.id); }}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

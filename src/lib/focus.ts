// Study timer (Pomodoro). Timestamps, not intervals, so it survives reloads,
// sleeping phones and closed tabs: elapsed = accrued + (now - startedAt).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import { useStore } from './store';
import { haptic, toast } from './toast';

export type Phase = 'idle' | 'focus' | 'break';
export interface Target { todoId: string | null; boardId: string | null; courseId: string | null; label: string }

interface FocusState extends Target {
  phase: Phase;
  running: boolean;
  duration: number; // seconds in the current phase
  startedAt: number | null; // ms timestamp of the current running stretch
  accrued: number; // seconds banked before the current stretch (pauses)
  sessionStart: string | null;
  focusMin: number;
  breakMin: number;
  autoBreak: boolean;
  sound: boolean;
  setTarget(t: Partial<Target>): void;
  setPrefs(p: Partial<Pick<FocusState, 'focusMin' | 'breakMin' | 'autoBreak' | 'sound'>>): void;
  start(t?: Partial<Target>): void;
  pause(): void;
  resume(): void;
  stop(): void;
  skip(): void;
  tick(): void;
}

export const elapsedOf = (s: Pick<FocusState, 'accrued' | 'running' | 'startedAt'>, now = Date.now()) =>
  s.accrued + (s.running && s.startedAt ? (now - s.startedAt) / 1000 : 0);

function chime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [523.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 1.2);
    });
    setTimeout(() => ctx.close(), 1600);
  } catch { /* audio unavailable */ }
}

async function notify(title: string, body: string) {
  if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { (await navigator.serviceWorker?.ready)?.showNotification(title, { body, icon: '/icon-192.png', badge: '/badge-96.png', tag: 'focus' }); } catch { /* ignore */ }
}

function logSession(s: FocusState, minutes: number) {
  if (minutes < 1) return;
  const row = useStore.getState().insert('focus_sessions', {
    todo_id: s.todoId, board_id: s.boardId, course_id: s.courseId, label: s.label,
    started_at: s.sessionStart ?? new Date(Date.now() - minutes * 60000).toISOString(), minutes,
  });
  toast(`Logged ${fmtMinutes(minutes)} of focus`, { label: 'Undo', run: () => useStore.getState().remove('focus_sessions', row.id) });
}

export const useFocus = create<FocusState>()(persist((set, get) => ({
  phase: 'idle', running: false, duration: 25 * 60, startedAt: null, accrued: 0, sessionStart: null,
  todoId: null, boardId: null, courseId: null, label: '',
  focusMin: 25, breakMin: 5, autoBreak: true, sound: true,

  setTarget: (t) => set(t),
  setPrefs: (p) => set((s) => ({ ...p, duration: s.phase === 'idle' ? (p.focusMin ?? s.focusMin) * 60 : s.duration })),
  start(t) {
    const s = get();
    set({ ...(t ?? {}), phase: 'focus', running: true, duration: s.focusMin * 60, startedAt: Date.now(), accrued: 0, sessionStart: new Date().toISOString() });
    haptic();
  },
  pause() {
    const s = get();
    if (!s.running) return;
    set({ running: false, accrued: elapsedOf(s), startedAt: null });
  },
  resume() {
    if (get().running || get().phase === 'idle') return;
    set({ running: true, startedAt: Date.now() });
  },
  stop() {
    const s = get();
    if (s.phase === 'focus') logSession(s, Math.floor(elapsedOf(s) / 60));
    set({ phase: 'idle', running: false, startedAt: null, accrued: 0, sessionStart: null, duration: s.focusMin * 60 });
  },
  skip() {
    const s = get();
    if (s.phase === 'break') set({ phase: 'idle', running: false, startedAt: null, accrued: 0, duration: s.focusMin * 60 });
    else if (s.phase === 'focus') get().stop();
  },
  tick() {
    const s = get();
    if (s.phase === 'idle' || !s.running) return;
    if (elapsedOf(s) < s.duration) return;
    if (s.sound) chime();
    haptic();
    if (s.phase === 'focus') {
      logSession(s, Math.round(s.duration / 60));
      notify('Focus session done', `${fmtMinutes(Math.round(s.duration / 60))}${s.label ? ` on ${s.label}` : ''}. Time for a break.`);
      if (s.autoBreak) set({ phase: 'break', running: true, duration: s.breakMin * 60, startedAt: Date.now(), accrued: 0, sessionStart: null });
      else set({ phase: 'idle', running: false, startedAt: null, accrued: 0, sessionStart: null, duration: s.focusMin * 60 });
    } else {
      notify('Break over', 'Ready for another round?');
      toast('Break over. Ready when you are.');
      set({ phase: 'idle', running: false, startedAt: null, accrued: 0, duration: s.focusMin * 60 });
    }
  },
}), { name: 'lifeos-focus', partialize: ({ setTarget: _a, setPrefs: _b, start: _c, pause: _d, resume: _e, stop: _f, skip: _g, tick: _h, ...rest }) => rest }));

/** Mount once: drives phase completion while the app is open, and on return. */
export function useFocusTicker() {
  useEffect(() => {
    const t = setInterval(() => useFocus.getState().tick(), 1000);
    const onVis = () => document.visibilityState === 'visible' && useFocus.getState().tick();
    document.addEventListener('visibilitychange', onVis);
    useFocus.getState().tick();
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);
}

/** Re-render every second while a timer is live. */
export function useNowWhile(active: boolean, ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60), r = s % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
export const fmtMinutes = (min: number) => (min < 60 ? `${min}m` : `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}`);

import { create } from 'zustand';
import { useStore } from './store';
import type { Table } from './types';

export interface Toast { id: number; text: string; action?: { label: string; run: () => void } }
interface T { toasts: Toast[]; show(text: string, action?: Toast['action'], ms?: number): void; dismiss(id: number): void }

let n = 0;
export const useToasts = create<T>((set, get) => ({
  toasts: [],
  show(text, action, ms) {
    const id = ++n;
    // one toast at a time: newest replaces older ones; undo toasts linger longer
    set({ toasts: [{ id, text, action }] });
    ms ??= action ? 5000 : 2200;
    setTimeout(() => get().dismiss(id), ms);
  },
  dismiss(id) { set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })); },
}));

export const toast = (text: string, action?: Toast['action']) => useToasts.getState().show(text, action);

/** Delete with an Undo toast instead of a confirm dialog. */
export function removeWithUndo(table: Table, id: string, label = 'Deleted') {
  const undo = useStore.getState().remove(table, id);
  toast(label, { label: 'Undo', run: undo });
}

export const haptic = () => {
  // browsers only allow vibration after the user has interacted with the page
  try { if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive !== false) navigator.vibrate?.(8); } catch { /* unsupported */ }
};

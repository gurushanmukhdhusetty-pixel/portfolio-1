import { create } from 'zustand';

/** App-wide UI state: global sheets, palette, collapsing title. */
interface UI {
  compactTitle: string | null;
  palette: boolean;
  capture: { open: boolean; kind: 'todo' | 'note' };
  todoId: string | null;
  noteId: string | null;
  locked: boolean;
  setPalette(v: boolean): void;
  openCapture(kind?: 'todo' | 'note'): void;
  closeCapture(): void;
  openTodo(id: string | null): void;
  openNote(id: string | null): void;
}

export const useUI = create<UI>((set) => ({
  compactTitle: null,
  palette: false,
  capture: { open: false, kind: 'todo' },
  todoId: null,
  noteId: null,
  locked: false,
  setPalette: (v) => set({ palette: v }),
  openCapture: (kind = 'todo') => set({ capture: { open: true, kind } }),
  closeCapture: () => set((s) => ({ capture: { ...s.capture, open: false } })),
  openTodo: (id) => set({ todoId: id }),
  openNote: (id) => set({ noteId: id }),
}));

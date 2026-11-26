import { api } from './api';
import { useStore } from './store';
import type { FileRow } from './types';
import { toast } from './toast';

export async function uploadFiles(boardId: string, files: FileList | File[], todoId: string | null = null, tags: string[] = []) {
  const s = useStore.getState();
  const out: FileRow[] = [];
  for (const f of Array.from(files)) {
    const path = await api.upload(f, s.storage);
    out.push(useStore.getState().insert('files', {
      board_id: boardId, todo_id: todoId, kind: 'file', name: f.name, storage_path: path, mime: f.type || null, size: f.size, tags,
    }));
  }
  return out;
}

/** Delete with undo; the stored file itself is removed only once the undo window has passed. */
export function deleteFileRow(f: FileRow) {
  const undo = useStore.getState().remove('files', f.id);
  let undone = false;
  toast(`Deleted ${f.kind === 'link' ? 'link' : 'file'}`, { label: 'Undo', run: () => { undone = true; undo(); } });
  if (f.storage_path) setTimeout(() => { if (!undone) api.deleteFile(f.storage_path!).catch(() => {}); }, 6000);
}

export const openFile = (f: FileRow) => window.open(f.kind === 'link' ? f.url! : api.fileUrl(f.storage_path!), '_blank', 'noopener');

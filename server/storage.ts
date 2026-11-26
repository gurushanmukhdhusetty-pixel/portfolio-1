// Files: private Vercel Blob in production, a local folder in development.
import { del, get } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { mkdir, readFile as fsRead, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

export const storageMode = () => (process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local');

const LOCAL_DIR = join(process.cwd(), '.local-files');
function localPath(p: string) {
  const n = normalize(p).replace(/^(\.\.(\/|\\|$))+/, '');
  if (!n || n.startsWith('/') || n.includes('..')) throw new Error('Bad path');
  return join(LOCAL_DIR, n);
}

export async function uploadToken(req: Request, body: HandleUploadBody) {
  return handleUpload({
    request: req,
    body,
    onBeforeGenerateToken: async () => ({
      addRandomSuffix: true,
      maximumSizeInBytes: 100 * 1024 * 1024,
    }),
    onUploadCompleted: async () => {},
  });
}

export async function writeLocalFile(path: string, data: Uint8Array) {
  if (storageMode() !== 'local') throw new Error('Local storage disabled');
  const p = localPath(path);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, data);
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', txt: 'text/plain', heic: 'image/heic',
};

export async function readFile(path: string): Promise<{ body: BodyInit; type: string } | null> {
  if (storageMode() === 'blob') {
    const r = await get(path, { access: 'private' });
    if (!r || !r.stream) return null;
    return { body: r.stream, type: r.headers.get('content-type') ?? '' };
  }
  try {
    const data = await fsRead(localPath(path));
    return { body: new Uint8Array(data), type: MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? '' };
  } catch {
    return null;
  }
}

export async function deleteFile(path: string) {
  if (storageMode() === 'blob') await del(path);
  else await rm(localPath(path), { force: true });
}

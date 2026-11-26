export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText);
  return body as T;
}

export const api = {
  session: () => call<{ authed: boolean; storage: 'blob' | 'local' }>('session'),
  login: (password: string) => call<{ ok: true }>('login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => call('logout', { method: 'POST' }),
  snapshot: () => call<Record<string, unknown[]>>('snapshot'),
  mutate: (ops: unknown[]) => call('mutate', { method: 'POST', body: JSON.stringify({ ops }) }),
  deleteFile: (path: string) => call('file-delete', { method: 'POST', body: JSON.stringify({ path }) }),
  fileUrl: (path: string) => `/api/file?path=${encodeURIComponent(path)}`,

  async upload(file: File, storage: 'blob' | 'local'): Promise<string> {
    const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';
    const pathname = `files/${new Date().toISOString().slice(0, 7)}/${safe}`;
    if (storage === 'blob') {
      const { upload } = await import('@vercel/blob/client');
      const blob = await upload(pathname, file, { access: 'private', handleUploadUrl: '/api/upload' });
      return blob.pathname;
    }
    const local = `${pathname.replace(/(\.[^.]*)?$/, `-${crypto.randomUUID().slice(0, 8)}$1`)}`;
    const res = await fetch(`/api/upload-local?path=${encodeURIComponent(local)}`, { method: 'PUT', body: file });
    if (!res.ok) throw new ApiError(res.status, 'Upload failed');
    return local;
  },
};

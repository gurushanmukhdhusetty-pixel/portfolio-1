// All API routes in one function (fewer cold starts). Web-standard Request/Response.
import { getDb } from './db.js';
import { TABLES, isJsonCol, snapshotSql, type TableName } from './schema.js';
import { clearCookie, isAuthed, passwordMatches, sessionCookie } from './auth.js';
import { deleteFile, readFile, storageMode, uploadToken, writeLocalFile } from './storage.js';

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });

type Op =
  | { op: 'insert'; table: string; row: Record<string, unknown> }
  | { op: 'update'; table: string; id: string; patch: Record<string, unknown> }
  | { op: 'delete'; table: string; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function checkCols(table: string, obj: Record<string, unknown>): [TableName, string[]] {
  if (!Object.hasOwn(TABLES, table)) throw new Error(`Unknown table ${table}`);
  const t = table as TableName;
  const cols = Object.keys(obj).filter((c) => c !== 'id' && c !== 'created_at' && c !== 'updated_at');
  for (const c of cols) if (!Object.hasOwn(TABLES[t], c)) throw new Error(`Unknown column ${t}.${c}`);
  return [t, cols];
}

const val = (col: string, v: unknown) => (isJsonCol(col) ? JSON.stringify(v ?? []) : v);

function toSql(op: Op): [string, unknown[]] {
  if (op.op === 'insert') {
    const id = op.row.id;
    if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Bad id');
    const [t, cols] = checkCols(op.table, op.row);
    const params = [id, ...cols.map((c) => val(c, op.row[c]))];
    const ph = params.map((_, i) => `$${i + 1}`);
    return [`insert into ${t} (id${cols.map((c) => `, ${c}`).join('')}) values (${ph.join(', ')}) on conflict do nothing`, params];
  }
  if (!UUID.test(op.id)) throw new Error('Bad id');
  if (op.op === 'update') {
    const [t, cols] = checkCols(op.table, op.patch);
    if (!cols.length) return ['select 1', []];
    const sets = cols.map((c, i) => `${c} = $${i + 2}`);
    return [`update ${t} set ${sets.join(', ')}, updated_at = now() where id = $1`, [op.id, ...cols.map((c) => val(c, op.patch[c]))]];
  }
  const [t] = checkCols(op.table, {});
  return [`delete from ${t} where id = $1`, [op.id]];
}

async function tooManyFailures(): Promise<boolean> {
  const db = await getDb();
  await db.query(`create table if not exists _login_failures (at timestamptz not null default now())`);
  const r = await db.query(`select count(*)::int as n from _login_failures where at > now() - interval '15 minutes'`);
  return r[0].n >= 10;
}

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const route = (url.searchParams.get('route') ?? url.pathname.replace(/^\/api\/?/, '')).replace(/\/$/, '');
  const secure = url.protocol === 'https:';

  try {
    // ---- public routes ----
    if (route === 'login' && req.method === 'POST') {
      const { password } = (await req.json().catch(() => ({}))) as { password?: string };
      if (await tooManyFailures()) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
      if (typeof password === 'string' && passwordMatches(password)) {
        return json({ ok: true }, 200, { 'set-cookie': sessionCookie(secure) });
      }
      const db = await getDb();
      await db.query(`insert into _login_failures default values`);
      await new Promise((r) => setTimeout(r, 700));
      return json({ error: 'Wrong password' }, 401);
    }
    if (route === 'logout') return json({ ok: true }, 200, { 'set-cookie': clearCookie });
    if (route === 'session') return json({ authed: isAuthed(req), storage: storageMode() });

    // Blob upload-completed callbacks are signed by Vercel, not cookie-authed.
    if (route === 'upload' && req.method === 'POST') {
      const body = await req.json();
      if (body?.type === 'blob.generate-client-token' && !isAuthed(req)) return json({ error: 'Unauthorized' }, 401);
      return json(await uploadToken(req, body));
    }

    // ---- everything below needs a session ----
    if (!isAuthed(req)) return json({ error: 'Unauthorized' }, 401);

    if (route === 'snapshot') {
      const db = await getDb();
      const rows = await db.query(snapshotSql());
      return json(rows[0].data);
    }

    if (route === 'mutate' && req.method === 'POST') {
      const { ops } = (await req.json()) as { ops: Op[] };
      if (!Array.isArray(ops) || ops.length > 500) return json({ error: 'Bad ops' }, 400);
      const db = await getDb();
      await db.tx(ops.map(toSql));
      return json({ ok: true, applied: ops.length });
    }

    if (route === 'upload-local' && req.method === 'PUT') {
      const path = url.searchParams.get('path') ?? '';
      await writeLocalFile(path, new Uint8Array(await req.arrayBuffer()));
      return json({ path });
    }

    if (route === 'file' && req.method === 'GET') {
      const path = url.searchParams.get('path') ?? '';
      const f = await readFile(path);
      if (!f) return json({ error: 'Not found' }, 404);
      return new Response(f.body, {
        headers: {
          'content-type': f.type || 'application/octet-stream',
          'cache-control': 'private, max-age=86400',
          'content-disposition': `inline; filename="${encodeURIComponent(path.split('/').pop() ?? 'file')}"`,
        },
      });
    }

    if (route === 'file-delete' && req.method === 'POST') {
      const { path } = (await req.json()) as { path: string };
      await deleteFile(path);
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}

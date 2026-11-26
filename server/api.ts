// All API routes in one function (fewer cold starts). Web-standard Request/Response.
import { getDb } from './db.js';
import { TABLES, isJsonCol, snapshotSql, type TableName } from './schema.js';
import { clearCookie, isAuthed, passwordMatches, sessionCookie } from './auth.js';
import { deleteFile, readFile, storageMode, uploadToken, writeLocalFile } from './storage.js';
import * as passkeys from './passkeys.js';
import * as push from './push.js';
import { composeBriefing } from './briefing.js';

const json = (data: unknown, status = 200, extra: Record<string, string> = {}, cookies: string[] = []) => {
  const h = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store', ...extra });
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(JSON.stringify(data), { status, headers: h });
};
const device = (req: Request) => {
  const ua = req.headers.get('user-agent') ?? '';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Device';
  const br = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${br}`;
};

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

    // ---- Face ID / passkey sign-in (public) ----
    if (route === 'passkey/available') return json({ available: await passkeys.hasPasskeys() });
    if (route === 'passkey/login-options' && req.method === 'POST') {
      const options = await passkeys.authenticationOptions(req);
      if (!options) return json({ error: 'No passkeys registered' }, 404);
      return json(options);
    }
    if (route === 'passkey/login-verify' && req.method === 'POST') {
      const { response } = (await req.json()) as { response: unknown };
      const ok = await passkeys.verifyAuthentication(req, response).catch((e) => { console.error(e); return false; });
      if (!ok) return json({ error: 'Face ID could not be verified. Try again.' }, 401);
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie(secure) });
    }

    // ---- daily morning briefing (Vercel Cron, ~08:00 IST) ----
    if (route === 'cron/morning') {
      const secret = process.env.CRON_SECRET;
      if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'Unauthorized' }, 401);
      const msg = await composeBriefing();
      if (url.searchParams.get('dry') === '1') return json(msg);
      const result = await push.pushToAll(msg);
      return json({ ...result, counts: msg.counts });
    }

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

    // ---- passkey management ----
    if (route === 'passkey/register-options' && req.method === 'POST') return json(await passkeys.registrationOptions(req));
    if (route === 'passkey/register-verify' && req.method === 'POST') {
      const { response } = (await req.json()) as { response: unknown };
      const ok = await passkeys.verifyRegistration(req, response, device(req)).catch((e) => { console.error(e); return false; });
      return json(ok ? { ok: true } : { error: 'Could not verify this device' }, ok ? 200 : 400);
    }
    if (route === 'passkey/list') return json(await passkeys.listPasskeys());
    if (route === 'passkey/delete' && req.method === 'POST') {
      const { id } = (await req.json()) as { id: string };
      await passkeys.deletePasskey(String(id));
      return json({ ok: true });
    }

    // ---- push notifications ----
    if (route === 'push/status') return json({ configured: !!push.vapidPublicKey(), key: push.vapidPublicKey(), devices: await push.countSubscriptions() });
    if (route === 'push/subscribe' && req.method === 'POST') {
      const { subscription } = (await req.json()) as { subscription: push.Sub };
      await push.saveSubscription(subscription, device(req));
      return json({ ok: true });
    }
    if (route === 'push/unsubscribe' && req.method === 'POST') {
      const { endpoint } = (await req.json()) as { endpoint: string };
      await push.removeSubscription(String(endpoint));
      return json({ ok: true });
    }
    if (route === 'push/test' && req.method === 'POST') {
      const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
      const msg = await composeBriefing();
      return json(await push.pushToAll(msg, endpoint));
    }
    if (route === 'briefing/preview') return json(await composeBriefing());

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

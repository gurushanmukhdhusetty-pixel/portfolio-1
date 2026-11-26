import { neon } from '@neondatabase/serverless';
import { ddl, SCHEMA_VERSION } from './schema.js';

type Q = [text: string, params: unknown[]];
interface Db {
  query(text: string, params?: unknown[]): Promise<any[]>;
  tx(queries: Q[]): Promise<void>;
}

let db: Db | null = null;
let ready: Promise<void> | null = null;

async function makeDb(): Promise<Db> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  // Local development against a plain Postgres (e.g. postgres://localhost/lifeos)
  if (/localhost|127\.0\.0\.1|\/var\/run/.test(url)) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: url });
    return {
      query: async (text, params = []) => (await pool.query(text, params as any[])).rows,
      tx: async (queries) => {
        const c = await pool.connect();
        try {
          await c.query('begin');
          for (const [t, p] of queries) await c.query(t, p as any[]);
          await c.query('commit');
        } catch (e) {
          await c.query('rollback');
          throw e;
        } finally {
          c.release();
        }
      },
    };
  }

  // Neon over HTTP: no connection pool to exhaust, ideal for serverless.
  const sql = neon(url);
  return {
    query: (text, params = []) => sql.query(text, params as any[]) as Promise<any[]>,
    tx: async (queries) => {
      if (queries.length) await sql.transaction(queries.map(([t, p]) => sql.query(t, p as any[])));
    },
  };
}

/** Returns a db handle, creating the schema on first use (zero manual migrations). */
export async function getDb(): Promise<Db> {
  if (!db) db = await makeDb();
  if (!ready) {
    ready = (async () => {
      try {
        const rows = await db!.query(`select value from _meta where key = 'schema_version'`);
        if (Number(rows[0]?.value) >= SCHEMA_VERSION) return;
      } catch {
        /* _meta missing: fresh database */
      }
      await db!.tx([
        ...ddl().map((s): Q => [s, []]),
        [
          `insert into _meta (key, value) values ('schema_version', $1)
           on conflict (key) do update set value = excluded.value`,
          [String(SCHEMA_VERSION)],
        ],
      ]);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  await ready;
  return db;
}

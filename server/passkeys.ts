// Face ID / Touch ID / fingerprint unlock via WebAuthn passkeys.
// Single user: every registered passkey belongs to the owner.
import {
  generateAuthenticationOptions, generateRegistrationOptions,
  verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { getDb } from './db.js';

/** Remember a challenge for 5 minutes; it can be redeemed exactly once. */
async function issue(challenge: string) {
  const db = await getDb();
  await db.query(`delete from _challenges where created_at < now() - interval '10 minutes'`);
  await db.query(`insert into _challenges (challenge) values ($1) on conflict do nothing`, [challenge]);
}
async function redeem(challenge: string) {
  const db = await getDb();
  const r = await db.query(`delete from _challenges where challenge = $1 and created_at > now() - interval '5 minutes' returning 1 as ok`, [challenge]);
  return r.length === 1;
}

const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64url');
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));

export function rp(req: Request) {
  const u = new URL(req.url);
  // Behind Vercel the public host arrives in x-forwarded-host.
  const host = req.headers.get('x-forwarded-host') ?? u.host;
  const proto = req.headers.get('x-forwarded-proto') ?? u.protocol.replace(':', '');
  return { rpID: host.split(':')[0], origin: `${proto}://${host}` };
}

interface Row { id: string; public_key: string; counter: string | number; transports: string | null; device: string | null; created_at: string; last_used_at: string | null }
const transportsOf = (r: Row) => (r.transports ? r.transports.split(',') : undefined);

export async function listPasskeys() {
  const db = await getDb();
  const rows: Row[] = await db.query(`select * from _passkeys order by created_at`);
  return rows.map((r) => ({ id: r.id, device: r.device, created_at: r.created_at, last_used_at: r.last_used_at }));
}

export async function deletePasskey(id: string) {
  const db = await getDb();
  await db.query(`delete from _passkeys where id = $1`, [id]);
}

export async function registrationOptions(req: Request) {
  const db = await getDb();
  const existing: Row[] = await db.query(`select * from _passkeys`);
  const { rpID } = rp(req);
  const options = await generateRegistrationOptions({
    rpName: 'Life OS',
    rpID,
    userName: 'Shanmukh',
    userDisplayName: 'Shanmukh',
    userID: new TextEncoder().encode('life-os-owner'),
    attestationType: 'none',
    excludeCredentials: existing.map((r) => ({ id: r.id, transports: transportsOf(r) })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required', authenticatorAttachment: 'platform' },
  });
  await issue(options.challenge);
  return options;
}

export async function verifyRegistration(req: Request, response: any, device: string) {
  const { rpID, origin } = rp(req);
  const v = await verifyRegistrationResponse({ response, expectedChallenge: redeem, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  if (!v.verified) return false;
  const c = v.registrationInfo.credential;
  const db = await getDb();
  await db.query(
    `insert into _passkeys (id, public_key, counter, transports, device) values ($1, $2, $3, $4, $5)
     on conflict (id) do update set public_key = excluded.public_key, counter = excluded.counter`,
    [c.id, b64(c.publicKey), c.counter, c.transports?.join(',') ?? null, device.slice(0, 80)],
  );
  return true;
}

export async function hasPasskeys() {
  const db = await getDb();
  const r = await db.query(`select count(*)::int as n from _passkeys`);
  return r[0].n > 0;
}

export async function authenticationOptions(req: Request) {
  const db = await getDb();
  const rows: Row[] = await db.query(`select * from _passkeys`);
  if (!rows.length) return null;
  const { rpID } = rp(req);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: rows.map((r) => ({ id: r.id, transports: transportsOf(r) })),
  });
  await issue(options.challenge);
  return options;
}

export async function verifyAuthentication(req: Request, response: any) {
  const db = await getDb();
  const rows: Row[] = await db.query(`select * from _passkeys where id = $1`, [response?.id]);
  const row = rows[0];
  if (!row) return false;
  const { rpID, origin } = rp(req);
  const v = await verifyAuthenticationResponse({
    response, expectedChallenge: redeem, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
    credential: { id: row.id, publicKey: fromB64(row.public_key), counter: Number(row.counter), transports: transportsOf(row) },
  });
  if (!v.verified) return false;
  await db.query(`update _passkeys set counter = $2, last_used_at = now() where id = $1`, [row.id, v.authenticationInfo.newCounter]);
  return true;
}

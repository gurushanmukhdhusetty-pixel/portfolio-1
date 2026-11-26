// Web Push (morning briefing). VAPID keys live in Vercel env vars.
import { sendNotification, setVapidDetails } from 'web-push';
import { getDb } from './db.js';

let configured = false;
function configure() {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('Push is not configured (VAPID keys missing)');
  if (!configured) {
    setVapidDetails(process.env.VAPID_SUBJECT || 'https://life-os-blond-one-20.vercel.app', pub, priv);
    configured = true;
  }
}

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

export interface Sub { endpoint: string; keys: { p256dh: string; auth: string } }

export async function saveSubscription(sub: Sub, device: string) {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth || !/^https:\/\//.test(sub.endpoint)) throw new Error('Bad subscription');
  const db = await getDb();
  await db.query(
    `insert into _push_subscriptions (endpoint, p256dh, auth, device) values ($1, $2, $3, $4)
     on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth, device.slice(0, 80)],
  );
}

export async function removeSubscription(endpoint: string) {
  const db = await getDb();
  await db.query(`delete from _push_subscriptions where endpoint = $1`, [endpoint]);
}

export async function countSubscriptions() {
  const db = await getDb();
  return (await db.query(`select count(*)::int as n from _push_subscriptions`))[0].n as number;
}

export interface PushMessage { title: string; body: string; url?: string; tag?: string }

/** Sends to every saved device; prunes subscriptions the push service says are gone. */
export async function pushToAll(msg: PushMessage, onlyEndpoint?: string) {
  configure();
  const db = await getDb();
  const subs: { endpoint: string; p256dh: string; auth: string }[] = onlyEndpoint
    ? await db.query(`select * from _push_subscriptions where endpoint = $1`, [onlyEndpoint])
    : await db.query(`select * from _push_subscriptions`);
  let sent = 0, removed = 0, failed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 6, urgency: 'normal', topic: msg.tag });
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) { await removeSubscription(s.endpoint); removed++; }
      else { failed++; console.error('push failed', e?.statusCode, e?.body); }
    }
  }));
  return { devices: subs.length, sent, removed, failed };
}

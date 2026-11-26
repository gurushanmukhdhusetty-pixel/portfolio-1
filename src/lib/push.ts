// Morning briefing push subscription for this device.
const call = async <T,>(path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
};

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

async function registration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('The offline worker is not active yet. Reload the app and try again.')), 4000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try { return await (await registration()).pushManager.getSubscription(); } catch { return null; }
}

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enableBriefing() {
  if (!pushSupported()) throw new Error(isIOS() ? 'Add Life OS to your Home Screen first, then enable this from the installed app.' : 'This browser does not support notifications.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked for Life OS. Allow them in your phone settings.');
  const status = await call<{ configured: boolean; key: string | null }>('push/status');
  if (!status.configured || !status.key) throw new Error('Notifications are not configured on the server yet.');
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(status.key) }));
  await call('push/subscribe', { subscription: sub.toJSON() });
}

export async function disableBriefing() {
  const sub = await currentSubscription();
  if (!sub) return;
  await call('push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestBriefing() {
  const sub = await currentSubscription();
  return call<{ sent: number; devices: number }>('push/test', { endpoint: sub?.endpoint });
}

export const previewBriefing = () => call<{ title: string; body: string }>('briefing/preview');

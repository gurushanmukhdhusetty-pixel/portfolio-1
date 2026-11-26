// Face ID / Touch ID via passkeys (WebAuthn). The browser library loads lazily.
async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

const FLAG = 'lifeos-passkey';
export const deviceHasPasskey = () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return false; } };
const setFlag = (v: boolean) => { try { if (v) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG); } catch { /* ignore */ } };

export async function passkeysSupported(): Promise<boolean> {
  const { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } = await import('@simplewebauthn/browser');
  return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable().catch(() => false));
}

/** What the biometric is called on this device, for button labels. */
export function biometricName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'Face ID';
  if (/Mac OS X/.test(ua)) return 'Touch ID';
  if (/Android/.test(ua)) return 'fingerprint';
  if (/Windows/.test(ua)) return 'Windows Hello';
  return 'passkey';
}

export async function registerPasskey() {
  const { startRegistration } = await import('@simplewebauthn/browser');
  const optionsJSON = await post<any>('passkey/register-options');
  const response = await startRegistration({ optionsJSON });
  await post('passkey/register-verify', { response });
  setFlag(true);
}

export async function unlockWithPasskey() {
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const optionsJSON = await post<any>('passkey/login-options');
  const response = await startAuthentication({ optionsJSON });
  await post('passkey/login-verify', { response });
  setFlag(true);
}

export async function passkeyAvailable(): Promise<boolean> {
  try { return (await (await fetch('/api/passkey/available')).json()).available === true; } catch { return false; }
}

export interface PasskeyInfo { id: string; device: string | null; created_at: string; last_used_at: string | null }
export const listPasskeys = async (): Promise<PasskeyInfo[]> => (await fetch('/api/passkey/list', { credentials: 'same-origin' })).json();
export async function removePasskey(id: string) { await post('passkey/delete', { id }); }
export const forgetDevicePasskey = () => setFlag(false);

/** Readable message for WebAuthn errors (cancel is the common one). */
export function passkeyError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return 'Cancelled';
  if (name === 'InvalidStateError') return 'This device is already set up';
  return (e as Error)?.message || 'Something went wrong';
}

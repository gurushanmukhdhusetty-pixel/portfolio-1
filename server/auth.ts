import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'los_session';
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days: log in once per device

function secret(): string {
  // Changing APP_PASSWORD automatically signs out every device.
  return (
    process.env.SESSION_SECRET ||
    createHash('sha256')
      .update(`${process.env.APP_PASSWORD ?? ''}|${process.env.DATABASE_URL ?? ''}|life-os`)
      .digest('hex')
  );
}

const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');

function safeEqual(a: string, b: string) {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error('APP_PASSWORD is not set');
  return safeEqual(input, expected);
}

export function sessionCookie(secure: boolean): string {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const value = `${exp}.${sign(exp)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function isAuthed(req: Request): boolean {
  const raw = req.headers.get('cookie') ?? '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

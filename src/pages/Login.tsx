import { useEffect, useState } from 'react';
import { ArrowRight, ScanFace } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';
import { biometricName, passkeyAvailable, passkeyError, passkeysSupported, unlockWithPasskey } from '../lib/passkey';
import { AnimatedLogo } from '../components/Logo';
import { cx } from '../lib/utils';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late,' : h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
}

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [faceId, setFaceId] = useState(false);

  useEffect(() => {
    Promise.all([passkeysSupported().catch(() => false), passkeyAvailable()]).then(([a, b]) => setFaceId(a && b));
  }, []);

  const enter = async () => { useStore.getState().setAuthed(true); await useStore.getState().sync(true); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw) return;
    setBusy(true); setErr('');
    try { await api.login(pw); await enter(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not reach the server'); setPw(''); setShake((n) => n + 1); }
    finally { setBusy(false); }
  }

  async function withFace() {
    setBusy(true); setErr('');
    try { await unlockWithPasskey(); await enter(); }
    catch (e) { const m = passkeyError(e); if (m !== 'Cancelled') setErr(m); }
    finally { setBusy(false); }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      {/* aurora in the five life colours */}
      <div className="aurora" style={{ ['--c1' as string]: '#6366f1', ['--c2' as string]: '#f43f5e', inset: '-25% -20% auto -20%', height: '70%', opacity: 0.3 }} />
      <div className="aurora" style={{ ['--c1' as string]: '#10b981', ['--c2' as string]: '#f59e0b', inset: 'auto -20% -25% -20%', height: '60%', opacity: 0.16 }} />

      <div className="relative w-full max-w-[340px] text-center">
        <AnimatedLogo size={84} className="mx-auto mb-7 text-ink" />
        <p className="rise text-sm text-mute" style={{ animationDelay: '0.35s' }}>{greeting()}</p>
        <h1 className="display rise text-[52px]" style={{ animationDelay: '0.45s' }}><em>Shanmukh</em></h1>

        <div className="rise mt-9 space-y-3" style={{ animationDelay: '0.6s' }}>
          {faceId && (
            <>
              <button className="btn-primary h-[52px] w-full rounded-[18px] text-[15px]" onClick={withFace} disabled={busy}>
                <ScanFace size={20} /> Unlock with {biometricName()}
              </button>
              <div className="flex items-center gap-3 py-1 text-[11px] uppercase tracking-[0.14em] text-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
            </>
          )}
          <form onSubmit={submit} key={shake} className={cx('relative', shake > 0 && 'shake')}>
            <input
              className="input h-[52px] rounded-[18px] pr-14 pl-5 text-center text-base tracking-[0.25em] placeholder:tracking-normal"
              type="password" placeholder="Password" autoFocus={!faceId} autoComplete="current-password"
              value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password"
            />
            <button disabled={busy || !pw} className="btn-primary absolute top-1.5 right-1.5 h-10 w-10 rounded-[14px] p-0" aria-label="Unlock">
              {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowRight size={18} />}
            </button>
          </form>
        </div>
        <div className="mt-4 h-5 text-sm text-red-500" role="alert">{err}</div>
      </div>
      <div className="absolute bottom-[max(env(safe-area-inset-bottom),20px)] text-[11px] tracking-[0.2em] text-faint uppercase">Life OS</div>
    </div>
  );
}

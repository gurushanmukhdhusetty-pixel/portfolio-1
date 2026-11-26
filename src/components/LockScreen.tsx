import { useEffect, useState } from 'react';
import { ScanFace } from 'lucide-react';
import { useUI } from '../lib/ui';
import { api, ApiError } from '../lib/api';
import { biometricName, deviceHasPasskey, passkeyError, unlockWithPasskey } from '../lib/passkey';
import { cx } from '../lib/utils';
import { AnimatedLogo } from './Logo';

const KEY = 'lifeos-applock';
export const appLockOn = () => { try { return localStorage.getItem(KEY) === '1' && deviceHasPasskey(); } catch { return false; } };
export const setAppLock = (v: boolean) => { try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* ignore */ } };

/** Locks on open and after 1 minute in the background, when App lock is on. */
export function useAppLock() {
  useEffect(() => {
    if (appLockOn()) useUI.setState({ locked: true });
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (appLockOn() && hiddenAt && Date.now() - hiddenAt > 60_000) useUI.setState({ locked: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
}

export function LockScreen() {
  const locked = useUI((s) => s.locked);
  const [pw, setPw] = useState('');
  const [usePw, setUsePw] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!locked) return null;

  const unlock = async () => {
    setBusy(true); setErr('');
    try { await unlockWithPasskey(); useUI.setState({ locked: false }); }
    catch (e) { const m = passkeyError(e); if (m !== 'Cancelled') setErr(m); }
    setBusy(false);
  };
  const withPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await api.login(pw); useUI.setState({ locked: false }); setPw(''); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not reach the server'); }
    setBusy(false);
  };

  return (
    <div className="fade-enter fixed inset-0 z-[80] grid place-items-center bg-bg/85 px-8 backdrop-blur-2xl">
      <div className="w-full max-w-xs text-center">
        <AnimatedLogo size={72} className="mx-auto mb-5 text-ink" />
        <h2 className="display text-[34px]">Locked</h2>
        <p className="mt-1 mb-7 text-sm text-mute">Life OS is locked on this device.</p>
        <button className="btn-primary h-12 w-full text-[15px]" onClick={unlock} disabled={busy} autoFocus>
          <ScanFace size={19} /> Unlock with {biometricName()}
        </button>
        {usePw ? (
          <form onSubmit={withPassword} className={cx('mt-3', err && 'shake')}>
            <input className="input h-11 text-center" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          </form>
        ) : (
          <button className="mt-4 text-sm text-mute underline-offset-4 hover:text-ink hover:underline" onClick={() => setUsePw(true)}>Use password instead</button>
        )}
        <div className="mt-3 h-5 text-sm text-red-500">{err}</div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Logo } from '../components/Logo';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setErr('');
    try {
      await api.login(pw);
      useStore.getState().setAuthed(true);
      await useStore.getState().sync(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not reach the server');
      setPw('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[680px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: 'conic-gradient(from 180deg, #3b82f6, #8b5cf6, #f43f5e, #f59e0b, #10b981, #3b82f6)' }} />
      <form onSubmit={submit} className="sheet-enter relative w-full max-w-xs text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[26px] border border-line bg-panel shadow-xl shadow-black/10">
          <Logo size={50} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Life OS</h1>
        <p className="mt-1 mb-6 text-sm text-mute">Welcome back, Shanmukh</p>
        <div className="relative">
          <input
            className="input h-12 pr-12 text-center text-base tracking-widest"
            type="password" placeholder="Password" autoFocus autoComplete="current-password"
            value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password"
          />
          <button disabled={busy || !pw} className="btn-primary absolute top-1.5 right-1.5 h-9 w-9 p-0" aria-label="Unlock">
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowRight size={18} />}
          </button>
        </div>
        <div className="mt-3 h-5 text-sm text-red-500">{err}</div>
      </form>
    </div>
  );
}

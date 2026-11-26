import { useEffect, useState, type ReactNode } from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Bell, CloudCheck, LogOut, Monitor, Moon, Palette, ScanFace, Send, Smartphone, Sun, Timer, Trash2, Volume2, Coffee, Lock } from 'lucide-react';
import { useStore } from '../lib/store';
import { useTheme, type ThemeMode } from '../lib/theme';
import { useFocus } from '../lib/focus';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { biometricName, deviceHasPasskey, forgetDevicePasskey, listPasskeys, passkeyError, passkeysSupported, registerPasskey, removePasskey, type PasskeyInfo } from '../lib/passkey';
import { currentSubscription, disableBriefing, enableBriefing, isIOS, isStandalone, previewBriefing, pushSupported, sendTestBriefing } from '../lib/push';
import { appLockOn, setAppLock } from '../components/LockScreen';
import { Logo } from '../components/Logo';
import { PageHeader, Segmented, Toggle } from '../components/ui';
import { cx } from '../lib/utils';

function Group({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="rise mb-7">
      <h2 className="eyebrow mb-2 px-1">{title}</h2>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
      {footer && <p className="mt-2 px-1 text-xs leading-relaxed text-mute">{footer}</p>}
    </section>
  );
}

function Row({ icon, color, label, sub, right }: { icon: ReactNode; color: string; label: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-[58px] items-center gap-3 px-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: color }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px]">{label}</div>
        {sub && <div className="text-xs text-mute">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function Appearance() {
  const { mode, setMode } = useTheme();
  return (
    <Group title="Appearance">
      <Row icon={<Palette size={16} />} color="#8b5cf6" label="Theme" sub="System follows your phone's setting"
        right={<Segmented<ThemeMode> value={mode} size="sm" onChange={(m) => setMode(m)} options={[
          { value: 'system', label: <Monitor size={14} />, title: 'System theme' },
          { value: 'light', label: <Sun size={14} />, title: 'Light theme' },
          { value: 'dark', label: <Moon size={14} />, title: 'Dark theme' },
        ]} />} />
    </Group>
  );
}

function Security() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [keys, setKeys] = useState<PasskeyInfo[]>([]);
  const [mine, setMine] = useState(deviceHasPasskey());
  const [lock, setLock] = useState(appLockOn());
  const [busy, setBusy] = useState(false);
  const bio = biometricName();
  const refresh = () => listPasskeys().then(setKeys).catch(() => {});
  useEffect(() => { passkeysSupported().then(setSupported).catch(() => setSupported(false)); refresh(); }, []);

  const setup = async () => {
    setBusy(true);
    try { await registerPasskey(); setMine(true); await refresh(); toast(`${bio} unlock is on for this device`); }
    catch (e) { const m = passkeyError(e); if (m !== 'Cancelled') toast(m); }
    setBusy(false);
  };
  const remove = async (k: PasskeyInfo) => {
    await removePasskey(k.id);
    const left = keys.filter((x) => x.id !== k.id);
    setKeys(left);
    if (!left.length) { forgetDevicePasskey(); setAppLock(false); setMine(false); setLock(false); }
    toast('Removed');
  };

  return (
    <Group title="Security" footer={supported === false ? `This browser can't use ${bio}. Open Life OS on your phone to set it up.` : `Sign in with ${bio} instead of your password. Your face or fingerprint never leaves the device.`}>
      <Row icon={<ScanFace size={17} />} color="#10b981" label={`${bio} unlock`} sub={mine ? 'On for this device' : 'Not set up on this device'}
        right={mine ? <span className="chip bg-emerald-500/15 text-emerald-500">On</span> : <button className="btn-soft py-1.5" disabled={!supported || busy} onClick={setup}>{busy ? 'Waiting…' : 'Set up'}</button>} />
      <Row icon={<Lock size={16} />} color="#64748b" label="App lock" sub={`Ask for ${bio} when opening, or after a minute away`}
        right={<Toggle label="App lock" on={lock} disabled={!mine} onChange={(v) => { setAppLock(v); setLock(v); toast(v ? 'App lock on' : 'App lock off'); }} />} />
      {keys.map((k) => (
        <Row key={k.id} icon={<Smartphone size={16} />} color="#94a3b8" label={k.device ?? 'Device'}
          sub={`Added ${formatDistanceToNowStrict(parseISO(k.created_at))} ago${k.last_used_at ? ` · used ${formatDistanceToNowStrict(parseISO(k.last_used_at))} ago` : ''}`}
          right={<button className="btn-ghost h-9 w-9 p-0 text-faint hover:text-red-500" onClick={() => remove(k)} aria-label={`Remove ${k.device}`}><Trash2 size={15} /></button>} />
      ))}
    </Group>
  );
}

function Notifications() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null);
  const supported = pushSupported();
  const needsInstall = isIOS() && !isStandalone();
  useEffect(() => { currentSubscription().then((s) => setOn(!!s)); previewBriefing().then(setPreview).catch(() => {}); }, []);

  const flip = async (v: boolean) => {
    setBusy(true);
    try {
      if (v) { await enableBriefing(); setOn(true); toast('Morning briefing on'); }
      else { await disableBriefing(); setOn(false); toast('Morning briefing off'); }
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true);
    try { const r = await sendTestBriefing(); toast(r.sent ? 'Sent. Check your notifications' : 'Could not deliver. Try turning it off and on'); }
    catch (e) { toast((e as Error).message); }
    setBusy(false);
  };

  return (
    <Group title="Notifications" footer={needsInstall ? 'On iPhone, notifications work once Life OS is on your Home Screen: tap Share → Add to Home Screen, then open it from there.' : 'Arrives between 7:30 and 8:30 every morning with what is due, your Top 3, exams and birthdays.'}>
      <Row icon={<Bell size={16} />} color="#f43f5e" label="Morning briefing" sub="Around 8:00 every day"
        right={<Toggle label="Morning briefing" on={on} disabled={busy || (!supported && !needsInstall)} onChange={flip} />} />
      {preview && (
        <div className="bg-panel2/50 px-4 py-4">
          <div className="eyebrow mb-2 text-[10px]">Tomorrow's preview</div>
          <div className="glass flex gap-3 rounded-[18px] p-3" style={{ boxShadow: 'var(--card-shadow)' }}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#0d0d12]"><Logo size={24} className="text-white" /></div>
            <div className="min-w-0 flex-1 text-[13px] leading-snug">
              <div className="flex items-baseline gap-2"><span className="font-semibold">{preview.title}</span><span className="ml-auto text-[11px] text-faint">8:00</span></div>
              <div className="whitespace-pre-line text-mute">{preview.body}</div>
            </div>
          </div>
        </div>
      )}
      <Row icon={<Send size={15} />} color="#3b82f6" label="Send a test now" sub={on ? 'Delivers the briefing to this device' : 'Turn the briefing on first'}
        right={<button className="btn-soft py-1.5" disabled={!on || busy} onClick={test}>Send</button>} />
    </Group>
  );
}

function FocusPrefs() {
  const f = useFocus();
  const opt = (n: number) => ({ value: String(n), label: `${n}m` });
  return (
    <Group title="Focus timer">
      <Row icon={<Timer size={16} />} color="#8b5cf6" label="Focus length"
        right={<Segmented value={String(f.focusMin)} size="sm" onChange={(v) => f.setPrefs({ focusMin: Number(v) })} options={[25, 45, 50, 90].map(opt)} />} />
      <Row icon={<Coffee size={16} />} color="#10b981" label="Break length"
        right={<Segmented value={String(f.breakMin)} size="sm" onChange={(v) => f.setPrefs({ breakMin: Number(v) })} options={[5, 10, 15].map(opt)} />} />
      <Row icon={<Coffee size={16} />} color="#14b8a6" label="Start breaks automatically" right={<Toggle label="Auto break" on={f.autoBreak} onChange={(v) => f.setPrefs({ autoBreak: v })} />} />
      <Row icon={<Volume2 size={16} />} color="#f59e0b" label="Chime when a session ends" right={<Toggle label="Chime" on={f.sound} onChange={(v) => f.setPrefs({ sound: v })} />} />
    </Group>
  );
}

function Data() {
  const { lastSync, queue, syncing, storage } = useStore();
  return (
    <Group title="Sync">
      <Row icon={<CloudCheck size={16} />} color="#0ea5e9" label={queue.length ? `${queue.length} change${queue.length > 1 ? 's' : ''} waiting to save` : 'Everything is saved'}
        sub={lastSync ? `Last synced ${formatDistanceToNowStrict(lastSync)} ago · files in ${storage === 'blob' ? 'private cloud storage' : 'local storage'}` : 'Not synced yet'}
        right={<button className="btn-soft py-1.5" disabled={syncing} onClick={() => useStore.getState().sync(true)}>{syncing ? 'Syncing…' : 'Sync now'}</button>} />
    </Group>
  );
}

export default function Settings() {
  const logout = async () => { await useStore.getState().flush(); await api.logout(); location.reload(); };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader compact="Settings" title="Settings" eyebrow="Life OS" />
      <Appearance />
      <Security />
      <Notifications />
      <FocusPrefs />
      <Data />
      <button onClick={logout} className={cx('card rise flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-medium text-red-500 transition hover:bg-red-500/5')}>
        <LogOut size={16} /> Log out
      </button>
      <div className="mt-8 flex flex-col items-center gap-2 text-xs text-faint">
        <Logo size={22} className="text-faint" />
        <span>Life OS · made for Shanmukh</span>
      </div>
    </div>
  );
}

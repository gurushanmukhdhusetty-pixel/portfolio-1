import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Cake, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { removeWithUndo } from '../lib/toast';
import type { Board, Person } from '../lib/types';
import { cx, nextBirthday } from '../lib/utils';
import { NoteEditor } from '../components/NoteEditor';
import { NoteRow } from './NotesTab';
import { Empty, Field, SearchInput, Section, Sheet } from '../components/ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const hue = (n: string) => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const h = hue(name);
  return <div className="grid shrink-0 place-items-center rounded-full text-xs font-semibold" style={{ width: size, height: size, background: `hsl(${h} 70% 55% / 0.18)`, color: `hsl(${h} 65% 50%)` }}>{initials(name) || '?'}</div>;
}

function PersonSheet({ person, board, onClose }: { person: Person | null; board: Board; onClose: () => void }) {
  const s = useStore();
  const [name, setName] = useState(person?.name ?? '');
  const [relation, setRelation] = useState(person?.relation ?? '');
  const [month, setMonth] = useState(person?.birth_month ? String(person.birth_month) : '');
  const [day, setDay] = useState(person?.birth_day ? String(person.birth_day) : '');
  const [year, setYear] = useState(person?.birth_year ? String(person.birth_year) : '');
  const [note, setNote] = useState<string | null>(null);
  const notes = person ? s.db.notes.filter((n) => n.person_id === person.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) : [];

  const save = (close = true) => {
    if (!name.trim()) return null;
    const row = { name: name.trim(), relation: relation.trim() || null, birth_month: month ? Number(month) : null, birth_day: day ? Math.min(31, Number(day)) : null, birth_year: year ? Number(year) : null };
    const id = person ? (s.update('people', person.id, row), person.id) : s.insert('people', { ...row, board_id: board.id }).id;
    if (close) onClose();
    return id;
  };
  const addNote = () => {
    const pid = person?.id ?? save(false);
    if (pid) setNote(s.insert('notes', { board_id: board.id, person_id: pid }).id);
  };

  return (
    <Sheet open onClose={() => (name.trim() ? save() : onClose())} title={person ? person.name : 'Add person'}
      footer={<div className="flex gap-2">
        {person && <button className="btn-ghost text-red-500" onClick={() => { removeWithUndo('people', person.id, `Removed ${person.name}`); onClose(); }}><Trash2 size={16} /> Remove</button>}
        <div className="flex-1" /><button className="btn-primary" onClick={() => save()}>Save</button>
      </div>}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar name={name || '?'} size={48} />
          <input className="input text-base font-medium" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!person} />
        </div>
        <Field label="Relation"><input className="input" placeholder="e.g. Close friend, Cousin, Mentor" value={relation} onChange={(e) => setRelation(e.target.value)} /></Field>
        <Field label="Birthday">
          <div className="grid grid-cols-[1fr_80px_90px] gap-2">
            <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Month</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
            <input className="input" inputMode="numeric" placeholder="Day" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            <input className="input" inputMode="numeric" placeholder="Year?" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </div>
        </Field>
        <div>
          <div className="mb-1.5 flex items-center"><span className="flex-1 text-xs font-medium text-mute">Notes {notes.length ? `· ${notes.length}` : ''}</span><button className="btn-ghost px-2 py-1 text-xs" onClick={addNote} disabled={!name.trim()}><Plus size={13} /> Note</button></div>
          {notes.length ? <div className="card divide-y divide-line overflow-hidden">{notes.map((n) => <NoteRow key={n.id} note={n} onOpen={() => setNote(n.id)} />)}</div>
            : <div className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-mute">Gift ideas, what they're up to, things to remember.</div>}
        </div>
      </div>
      <NoteEditor id={note} onClose={() => setNote(null)} />
    </Sheet>
  );
}

export default function PeopleTab({ board }: { board: Board }) {
  const all = useStore((s) => s.db.people);
  const notes = useStore((s) => s.db.notes);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Person | 'new' | null>(() => all.find((p) => p.id === params.get('person')) ?? null);
  useEffect(() => { if (params.get('person')) setParams({ tab: 'people' }, { replace: true }); }, [params, setParams]);

  const people = all.filter((p) => p.board_id === board.id);
  const upcoming = people.map((p) => ({ p, nb: nextBirthday(p) })).filter((x) => x.nb && x.nb.days <= 30).sort((a, b) => a.nb!.days - b.nb!.days);
  const list = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.relation?.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      {upcoming.length > 0 && (
        <Section title={<span className="flex items-center gap-1.5"><Cake size={12} className="text-pink-500" /> Birthdays · next 30 days</span>}>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:px-0">
            {upcoming.map(({ p, nb }) => (
              <button key={p.id} onClick={() => setOpen(p)} className={cx('card flex w-36 shrink-0 flex-col items-center gap-1.5 p-3 text-center transition hover:shadow-md', nb!.days === 0 && 'border-pink-500/60 bg-pink-500/5')}>
                <Avatar name={p.name} size={44} />
                <div className="w-full truncate text-sm font-medium">{p.name}</div>
                <div className={cx('text-[11px]', nb!.days === 0 ? 'font-semibold text-pink-500' : nb!.days <= 7 ? 'text-ink' : 'text-mute')}>
                  {nb!.days === 0 ? 'Today! 🎉' : nb!.days === 1 ? 'Tomorrow' : `${format(nb!.date, 'd MMM')} · ${nb!.days}d`}
                </div>
                {nb!.turning && <div className="text-[10px] text-faint">turns {nb!.turning}</div>}
              </button>
            ))}
          </div>
        </Section>
      )}
      <div className="mb-3 flex gap-2">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search people" /></div>
        <button className="btn-primary" onClick={() => setOpen('new')}><Plus size={16} /> Person</button>
      </div>
      {list.length ? (
        <div className="card divide-y divide-line overflow-hidden">
          {list.map((p) => {
            const nb = nextBirthday(p);
            const n = notes.filter((x) => x.person_id === p.id).length;
            return (
              <button key={p.id} onClick={() => setOpen(p)} className="row w-full text-left">
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px]">{p.name}</div>
                  <div className="truncate text-[11px] text-mute">{[p.relation, n ? `${n} note${n > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ') || ' '}</div>
                </div>
                {nb && <span className="flex items-center gap-1 text-xs text-mute"><Cake size={12} />{format(nb.date, 'd MMM')}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <Empty icon={q ? <UserRound size={22} /> : <Users size={22} />} title={q ? 'No one found' : 'Your people'} hint={q ? undefined : 'Add friends and family with birthdays. Upcoming ones show up here and on Today.'} />
      )}
      {open && <PersonSheet person={open === 'new' ? null : open} board={board} onClose={() => setOpen(null)} />}
    </div>
  );
}

// Composes the morning briefing from the database, in India time.
import { getDb } from './db.js';
import type { PushMessage } from './push.js';

const TZ = 'Asia/Kolkata';
export const istDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD
const istTime = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function composeBriefing(now = new Date()): Promise<PushMessage & { counts: Record<string, number> }> {
  const db = await getDb();
  const today = istDate(now);
  const [m, d] = [Number(today.slice(5, 7)), Number(today.slice(8, 10))];
  const live = `(t.board_id is null or exists (select 1 from boards b where b.id = t.board_id and not b.archived))`;

  const due = await db.query(
    `select t.title, t.due_date::text as due, t.priority from todos t
     where t.status <> 'done' and t.parent_id is null and t.due_date <= $1::date and ${live}
     order by t.due_date, t.priority`, [today]);
  const top3 = await db.query(
    `select t.title from todos t where t.top3 is not null and t.status <> 'done' and ${live} order by t.top3`);
  const exams = await db.query(
    `select a.title, a.due_at, c.name as course from assessments a left join courses c on c.id = a.course_id
     where not a.done and a.due_at is not null and (a.due_at at time zone '${TZ}')::date = $1::date order by a.due_at`, [today]);
  const nextExam = exams.length ? null : (await db.query(
    `select a.title, a.due_at from assessments a where not a.done and a.due_at > now() order by a.due_at limit 1`))[0];
  const bdays = await db.query(`select name from people where birth_month = $1 and birth_day = $2`, [m, d]);

  const dueToday = due.filter((t: any) => t.due === today).length;
  const overdue = due.length - dueToday;
  const lines: string[] = [];

  if (dueToday || overdue) lines.push([dueToday ? `${dueToday} due today` : '', overdue ? `${overdue} overdue` : ''].filter(Boolean).join(' · '));
  if (top3.length) lines.push(`⭐ ${top3.map((t: any) => trunc(t.title, 28)).join(' / ')}`);
  else if (due.length) lines.push(`→ ${trunc(due[0].title, 60)}`);
  for (const e of exams.slice(0, 2)) lines.push(`📝 ${trunc(e.title, 30)}${e.course ? ` (${trunc(e.course, 20)})` : ''} at ${istTime(e.due_at)}`);
  if (nextExam) {
    const days = Math.round((new Date(nextExam.due_at).getTime() - now.getTime()) / 864e5);
    if (days <= 7) lines.push(`📝 ${trunc(nextExam.title, 32)} in ${days <= 1 ? '1 day' : `${days} days`}`);
  }
  for (const b of bdays.slice(0, 2)) lines.push(`🎂 ${b.name}'s birthday today`);
  if (!lines.length) lines.push('Nothing due today. Clear runway ✨');

  return {
    title: 'Good morning, Shanmukh ☀️',
    body: lines.join('\n'),
    url: '/',
    tag: 'morning-briefing',
    counts: { dueToday, overdue, top3: top3.length, exams: exams.length, birthdays: bdays.length },
  };
}

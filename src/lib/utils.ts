import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, isWeekend, parseISO } from 'date-fns';
import type { Person, Recurrence } from './types';

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');
export const toISO = (d: Date) => format(d, 'yyyy-MM-dd');

export function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

export function nextDue(from: string | null, r: Recurrence): string {
  const base = from ? parseISO(from) : new Date();
  let d = base;
  if (r === 'daily') d = addDays(base, 1);
  else if (r === 'weekly') d = addWeeks(base, 1);
  else if (r === 'monthly') d = addMonths(base, 1);
  else if (r === 'weekdays') { d = addDays(base, 1); while (isWeekend(d)) d = addDays(d, 1); }
  // never schedule the next one in the past
  const today = parseISO(todayISO());
  while (d < today) d = r === 'monthly' ? addMonths(d, 1) : r === 'weekly' ? addWeeks(d, 1) : addDays(d, 1);
  return toISO(d);
}

export function dueLabel(due: string | null): { text: string; tone: 'overdue' | 'today' | 'soon' | 'later' } | null {
  if (!due) return null;
  const n = differenceInCalendarDays(parseISO(due), new Date());
  if (n < 0) return { text: n === -1 ? 'Yesterday' : `${-n}d overdue`, tone: 'overdue' };
  if (n === 0) return { text: 'Today', tone: 'today' };
  if (n === 1) return { text: 'Tomorrow', tone: 'soon' };
  if (n < 7) return { text: format(parseISO(due), 'EEE'), tone: 'soon' };
  return { text: format(parseISO(due), 'd MMM'), tone: 'later' };
}

/** Next birthday date and days until it (0 = today). */
export function nextBirthday(p: Person): { date: Date; days: number; turning: number | null } | null {
  if (!p.birth_month || !p.birth_day) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let d = new Date(today.getFullYear(), p.birth_month - 1, p.birth_day);
  if (d < today) d = new Date(today.getFullYear() + 1, p.birth_month - 1, p.birth_day);
  return { date: d, days: differenceInCalendarDays(d, today), turning: p.birth_year ? d.getFullYear() - p.birth_year : null };
}

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function fmtSize(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const maxPos = (rows: { position: number }[]) => rows.reduce((m, r) => Math.max(m, r.position), 0) + 1;

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

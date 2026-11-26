import type { GradeComponent, Score } from './types';

/** Parse "17/20", "85%", "85" (percent) or "8.5/10". Returns null for blank/invalid. */
export function parseScore(input: string): Score {
  const s = input.trim().replace(/\s+/g, '');
  if (!s) return null;
  const frac = s.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) {
    const score = Number(frac[1]), max = Number(frac[2]);
    return max > 0 ? { score, max } : null;
  }
  const pct = s.match(/^(\d+(?:\.\d+)?)%?$/);
  if (pct) return { score: Math.min(Number(pct[1]), 100), max: 100 };
  return null;
}

export const fmtScore = (s: Score) => (!s ? '' : s.max === 100 ? `${+s.score.toFixed(2)}%` : `${+s.score.toFixed(2)}/${+s.max.toFixed(2)}`);
const pct = (s: NonNullable<Score>) => (s.score / s.max) * 100;

export interface ComponentResult {
  earned: number;      // points of the final grade locked in (0..weight)
  remaining: number;   // weight still to be graded
  average: number | null; // average % over counted graded items
  counted: Set<number>;   // indexes of items currently counted (best-of)
}

export function componentResult(c: GradeComponent): ComponentResult {
  const k = Math.min(c.best_of ?? c.item_count, c.item_count);
  const graded = (c.scores ?? []).slice(0, c.item_count)
    .map((s, i) => (s ? { i, p: pct(s) } : null))
    .filter((x): x is { i: number; p: number } => !!x)
    .sort((a, b) => b.p - a.p);
  const counted = graded.slice(0, k);
  const avg = counted.length ? counted.reduce((n, x) => n + x.p, 0) / counted.length : null;
  const per = c.weight / k; // each counted item is worth this much of the course
  return {
    earned: counted.reduce((n, x) => n + (per * x.p) / 100, 0),
    remaining: per * Math.max(0, k - counted.length),
    average: avg,
    counted: new Set(counted.map((x) => x.i)),
  };
}

export interface CourseResult {
  totalWeight: number;
  earned: number;
  remaining: number;
  current: number | null; // % on what's been graded so far
  maxPossible: number;
  needed: number | null;  // average % needed on everything remaining to hit target
  status: 'secured' | 'on-track' | 'stretch' | 'out-of-reach' | 'done' | 'no-data';
}

export function courseResult(components: GradeComponent[], target: number): CourseResult {
  const rs = components.map(componentResult);
  const totalWeight = components.reduce((n, c) => n + Number(c.weight), 0);
  const earned = rs.reduce((n, r) => n + r.earned, 0);
  const remaining = rs.reduce((n, r) => n + r.remaining, 0);
  const graded = totalWeight - remaining;
  const current = graded > 0.0001 ? (earned / graded) * 100 : null;
  const needed = remaining > 0.0001 ? ((target - earned) / remaining) * 100 : null;
  let status: CourseResult['status'];
  if (current === null) status = 'no-data';
  else if (remaining <= 0.0001) status = 'done';
  else if (needed! <= 0) status = 'secured';
  else if (needed! > 100) status = 'out-of-reach';
  else if (needed! > 85) status = 'stretch';
  else status = 'on-track';
  return { totalWeight, earned, remaining, current, maxPossible: earned + remaining, needed, status };
}

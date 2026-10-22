// Ingen Firebase-import: används av bygget, adminvyn och eventkortet.
// Logiken för vad som blir publikt speglas av functions/src/results.ts (publicEntries); håll dem synkade.
import type { PublicResultEntry, ResultRow } from '../types/result';

/** Total tid i sekunder: egen angiven tid, annars måltid minus starttid. null om löparen inte är i mål. */
export function rowSeconds(r: Pick<ResultRow, 'totalSeconds' | 'startAt' | 'finishAt'>): number | null {
  if (r.totalSeconds !== null) return r.totalSeconds;
  if (r.startAt && r.finishAt) {
    const s = Math.round((r.finishAt.getTime() - r.startAt.getTime()) / 1000);
    return s >= 0 ? s : null;
  }
  return null;
}

/** Det som blir publikt av de interna raderna (förhandsvisning i adminvyn) */
export function publicEntries(rows: ResultRow[]): PublicResultEntry[] {
  const out: PublicResultEntry[] = [];
  for (const r of rows) {
    const name = r.name.trim();
    if (!name || r.show === 'hidden') continue;
    const course = r.course.trim();
    if (r.show === 'participated') out.push({ name, course, seconds: null });
    else {
      const seconds = rowSeconds(r);
      if (seconds !== null) out.push({ name, course, seconds });
    }
  }
  return out.sort(
    (a, b) =>
      a.course.localeCompare(b.course, 'sv') ||
      (a.seconds === null ? 1 : 0) - (b.seconds === null ? 1 : 0) ||
      (a.seconds ?? 0) - (b.seconds ?? 0) ||
      a.name.localeCompare(b.name, 'sv'),
  );
}

/** 2550 → '42:30', 3725 → '1:02:05' */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** '42:30' eller '1:02:05' → sekunder; null om det inte går att läsa */
export function parseDuration(text: string): number | null {
  const m = /^\s*(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\s*$/.exec(text);
  if (!m) return null;
  const [h, min, s] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
  if (s > 59 || (m[1] !== undefined && min > 59)) return null;
  const total = h * 3600 + min * 60 + s;
  return total <= 86400 ? total : null;
}

/** Grupperar den sorterade listan per bana (i ordning) */
export function groupByCourse(entries: PublicResultEntry[]): { course: string; entries: PublicResultEntry[] }[] {
  const groups: { course: string; entries: PublicResultEntry[] }[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.course === e.course) last.entries.push(e);
    else groups.push({ course: e.course, entries: [e] });
  }
  return groups;
}

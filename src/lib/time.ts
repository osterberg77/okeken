// All visning sker i svensk tid oavsett var koden körs (bygget körs i UTC).
// Ett "dagnyckel" är 'YYYY-MM-DD' i Europe/Stockholm.

export const TZ = 'Europe/Stockholm';

const keyFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function dayKey(d: Date | string): string {
  return keyFmt.format(new Date(d));
}

function keyToUtc(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key: string, n: number): string {
  const d = keyToUtc(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((keyToUtc(to).getTime() - keyToUtc(from).getTime()) / 86_400_000);
}

export function isWeekend(key: string): boolean {
  const wd = keyToUtc(key).getUTCDay();
  return wd === 0 || wd === 6;
}

export function keyDayOfMonth(key: string): number {
  return Number(key.slice(8, 10));
}

const stripDot = (s: string) => s.replace(/\.$/, '');

const keyWeekdayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', weekday: 'short' });
const keyMonthShortFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', month: 'short' });
const keyMonthLongFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', month: 'long', year: 'numeric' });

export function keyWeekdayShort(key: string): string {
  return stripDot(keyWeekdayFmt.format(keyToUtc(key)));
}

export function keyMonthShort(key: string): string {
  return stripDot(keyMonthShortFmt.format(keyToUtc(key)));
}

export function keyMonthLabel(key: string): string {
  return keyMonthLongFmt.format(keyToUtc(key));
}

const timeFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

const keyWeekdayLongFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', weekday: 'long' });
const keyMonthNameFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', month: 'long' });

/** 'tisdag' */
export function keyWeekdayLong(key: string): string {
  return keyWeekdayLongFmt.format(keyToUtc(key));
}

/** 'tisdag 22 september' */
export function formatKeyLong(key: string): string {
  return `${keyWeekdayLong(key)} ${keyDayOfMonth(key)} ${keyMonthNameFmt.format(keyToUtc(key))}`;
}

/** 'tisdag 22 sep' */
export function formatKeyMedium(key: string): string {
  return `${keyWeekdayLong(key)} ${keyDayOfMonth(key)} ${keyMonthShort(key)}`;
}

/** Klockslag för listor och detaljvy: '17:00–18:00' samma dag, '17:00' vid period, '' utan tid. */
export function formatEventTime(startsAt: string, endsAt: string): string {
  if (startsAt === endsAt) return '';
  if (dayKey(startsAt) === dayKey(endsAt)) return `${formatTime(startsAt)}–${formatTime(endsAt)}`;
  return formatTime(startsAt);
}

import { describe, expect, it } from 'vitest';
import { entrySeconds, publicEntries } from '../../functions/src/results';

const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });
const row = (over: Record<string, unknown> = {}) => ({
  name: 'Anna Andersson',
  course: 'Röd',
  memberUid: 'uid1',
  youth: true,
  show: 'time',
  startAt: ts('2026-10-27T16:00:00Z'),
  finishAt: ts('2026-10-27T16:42:30Z'),
  totalSeconds: null,
  ...over,
});

describe('entrySeconds', () => {
  it('räknar måltid minus starttid', () => expect(entrySeconds(row())).toBe(2550));
  it('egen total tid går före', () => expect(entrySeconds(row({ totalSeconds: 2400 }))).toBe(2400));
  it('saknad måltid eller negativ tid ger null', () => {
    expect(entrySeconds(row({ finishAt: null }))).toBeNull();
    expect(entrySeconds(row({ finishAt: ts('2026-10-27T15:00:00Z') }))).toBeNull();
  });
});

describe('publicEntries', () => {
  it('släpper aldrig igenom ungdomsmarkering eller medlemslänk', () => {
    const [e] = publicEntries([row()]);
    expect(Object.keys(e).sort()).toEqual(['course', 'name', 'seconds']);
    expect(JSON.stringify(e)).not.toMatch(/youth|memberUid|uid1/);
  });
  it('dolda rader tas inte med, deltagit visas utan tid', () => {
    const out = publicEntries([row({ show: 'hidden' }), row({ name: 'Bo', show: 'participated', finishAt: null })]);
    expect(out).toEqual([{ name: 'Bo', course: 'Röd', seconds: null }]);
  });
  it('visa tid utan tid (inte i mål) utelämnas', () => {
    expect(publicEntries([row({ finishAt: null })])).toEqual([]);
  });
  it('sorterar på bana, snabbast först, deltagit sist, sedan namn', () => {
    const out = publicEntries([
      row({ name: 'C', course: 'Röd', totalSeconds: 3000 }),
      row({ name: 'A', course: 'Röd', totalSeconds: 2000 }),
      row({ name: 'D', course: 'Röd', show: 'participated' }),
      row({ name: 'B', course: 'Blå', totalSeconds: 4000 }),
    ]);
    expect(out.map((e) => `${e.course}:${e.name}`)).toEqual(['Blå:B', 'Röd:A', 'Röd:C', 'Röd:D']);
  });
  it('rader utan namn eller med okänt läge hoppas över', () => {
    expect(publicEntries([row({ name: '  ' }), row({ show: 'x' })])).toEqual([]);
  });
});

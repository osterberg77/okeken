import { describe, expect, it } from 'vitest';
import { formatDuration, groupByCourse, parseDuration, publicEntries, rowSeconds } from '../../src/lib/results';
import type { ResultRow } from '../../src/types/result';

const row = (over: Partial<ResultRow> = {}): ResultRow => ({
  id: 'r',
  name: 'Anna',
  course: 'Röd',
  memberUid: 'uid1',
  startAt: new Date('2026-10-27T16:00:00Z'),
  finishAt: new Date('2026-10-27T16:42:30Z'),
  totalSeconds: null,
  youth: true,
  show: 'time',
  updatedAt: null,
  ...over,
});

describe('results', () => {
  it('formaterar och läser tider', () => {
    expect(formatDuration(2550)).toBe('42:30');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(5)).toBe('0:05');
    expect(parseDuration('42:30')).toBe(2550);
    expect(parseDuration('1:02:05')).toBe(3725);
    for (const bad of ['', '42', '42:75', '1:75:00', 'abc', '99:99:99']) expect(parseDuration(bad)).toBeNull();
  });
  it('tid: egen total tid före måltid minus start', () => {
    expect(rowSeconds(row())).toBe(2550);
    expect(rowSeconds(row({ totalSeconds: 1800 }))).toBe(1800);
    expect(rowSeconds(row({ finishAt: null }))).toBeNull();
  });
  it('det publika innehåller bara namn, bana och tid', () => {
    const e = publicEntries([row()]);
    expect(e).toEqual([{ name: 'Anna', course: 'Röd', seconds: 2550 }]);
    expect(JSON.stringify(e)).not.toMatch(/youth|memberUid|uid1/);
  });
  it('dolda utelämnas, deltagit utan tid, ej i mål utelämnas', () => {
    expect(publicEntries([row({ show: 'hidden' }), row({ name: 'B', show: 'participated', finishAt: null }), row({ name: 'C', finishAt: null })])).toEqual([
      { name: 'B', course: 'Röd', seconds: null },
    ]);
  });
  it('grupperar per bana', () => {
    const g = groupByCourse(publicEntries([row({ course: 'Blå', name: 'X' }), row({ name: 'Y' })]));
    expect(g.map((x) => x.course)).toEqual(['Blå', 'Röd']);
  });
});

import { fromStockholmInput } from '../../src/lib/time';

describe('fromStockholmInput med sekunder', () => {
  it('läser HH:mm och HH:mm:ss (vintertid, UTC+1)', () => {
    expect(fromStockholmInput('2026-11-03T18:30').toISOString()).toBe('2026-11-03T17:30:00.000Z');
    expect(fromStockholmInput('2026-11-03T18:30:45').toISOString()).toBe('2026-11-03T17:30:45.000Z');
  });
  it('läser sommartid (UTC+2)', () => {
    expect(fromStockholmInput('2026-07-01T18:30:07').toISOString()).toBe('2026-07-01T16:30:07.000Z');
  });
});

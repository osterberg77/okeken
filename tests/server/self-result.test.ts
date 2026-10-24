import { describe, expect, it } from 'vitest';
import { effectiveShow, InvalidSelfResult, parseSelfResult } from '../../functions/src/self-result';

const ok = { slug: 'tisdagstraning-2026-10-27', name: ' Anna ', course: 'Röd', totalSeconds: 2550, show: 'time', rating: 4, trap: '' };

describe('parseSelfResult', () => {
  it('rensar och godkänner giltiga uppgifter', () => {
    expect(parseSelfResult(ok)).toEqual({ ...ok, name: 'Anna' });
  });
  it('tid och betyg är valfria', () => {
    const r = parseSelfResult({ ...ok, totalSeconds: undefined, rating: null });
    expect(r.totalSeconds).toBeNull();
    expect(r.rating).toBeNull();
  });
  it('nekar ogiltiga värden', () => {
    for (const bad of [{ slug: 'a/b' }, { slug: '' }, { show: 'alla' }, { totalSeconds: -1 }, { totalSeconds: 90000 }, { totalSeconds: 1.5 }, { rating: 0 }, { rating: 6 }, { rating: 2.5 }]) {
      expect(() => parseSelfResult({ ...ok, ...bad })).toThrow(InvalidSelfResult);
    }
  });
  it('kapar för långa texter', () => {
    expect(parseSelfResult({ ...ok, name: 'x'.repeat(300) }).name).toHaveLength(100);
  });
});

describe('effectiveShow', () => {
  it('"visa tid" utan tid blir "bara deltagit"', () => {
    expect(effectiveShow({ show: 'time', totalSeconds: null })).toBe('participated');
    expect(effectiveShow({ show: 'time', totalSeconds: 100 })).toBe('time');
    expect(effectiveShow({ show: 'hidden', totalSeconds: null })).toBe('hidden');
  });
});

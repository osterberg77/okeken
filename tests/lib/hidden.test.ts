import { describe, expect, it } from 'vitest';
import { normalizeName, omitHidden } from '../../src/lib/hidden';

const hidden = { uids: new Set(['u1']), names: new Set([normalizeName('Anna Svensson')]) };

describe('omitHidden', () => {
  it('utelämnar rader vars medlemslänk är dold', () => {
    const out = omitHidden([{ name: 'Valfritt', memberUid: 'u1' }, { name: 'Bo', memberUid: 'u2' }], hidden);
    expect(out).toEqual([{ name: 'Bo', memberUid: 'u2' }]);
  });
  it('utelämnar fritext med dold persons namn, oavsett skiftläge och mellanrum', () => {
    const out = omitHidden([{ name: '  anna  SVENSSON ' }, { name: 'Anna Persson', memberUid: null }], hidden);
    expect(out).toEqual([{ name: 'Anna Persson', memberUid: null }]);
  });
  it('en länkad rad avgörs av uid, inte av namnet', () => {
    expect(omitHidden([{ name: 'Anna Svensson', memberUid: 'u2' }], hidden)).toHaveLength(1);
  });
  it('ändrar inget när ingen är dold', () => {
    const rows = [{ name: 'Anna Svensson', memberUid: 'u1' }];
    expect(omitHidden(rows, { uids: new Set(), names: new Set() })).toEqual(rows);
  });
});

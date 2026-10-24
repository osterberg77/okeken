import { describe, expect, it } from 'vitest';
import { toExtraPlaces } from '../../src/lib/place-icons';

describe('toExtraPlaces', () => {
  it('ger tom lista för allt som inte är en lista', () => {
    expect(toExtraPlaces(undefined)).toEqual([]);
    expect(toExtraPlaces('x')).toEqual([]);
  });

  it('behåller giltiga platser, gör okänd ikon till "other" och hoppar över platser utan koordinater', () => {
    expect(
      toExtraPlaces([
        { icon: 'toilet', label: 'WC', lat: 58.2, lng: 16 },
        { icon: 'ufo', lat: 58.3, lng: 16.1 },
        { icon: 'parking', label: 'P2' },
        null,
      ]),
    ).toEqual([
      { icon: 'toilet', label: 'WC', lat: 58.2, lng: 16 },
      { icon: 'other', label: '', lat: 58.3, lng: 16.1 },
    ]);
  });
});

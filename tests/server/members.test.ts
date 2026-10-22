import { describe, expect, it } from 'vitest';
import { memberDoc } from '../../functions/src/members';

describe('memberDoc', () => {
  it('ger null för den som inte är medlem eller saknar namn', () => {
    expect(memberDoc(undefined)).toBeNull();
    expect(memberDoc({ displayName: 'A', permissions: [] })).toBeNull();
    expect(memberDoc({ displayName: '  ', permissions: ['member'] })).toBeNull();
    expect(memberDoc({ permissions: ['member'] })).toBeNull();
  });
  it('tar aldrig med e-post eller behörigheter', () => {
    const m = memberDoc({ displayName: 'Anna', email: 'a@b.se', permissions: ['board'] });
    expect(m).toEqual({ displayName: 'Anna', publicName: false });
  });
  it('publicName kräver godkänd policy och att namnet inte är dolt', () => {
    const base = { displayName: 'Anna', permissions: ['member'] };
    expect(memberDoc({ ...base, consent: { version: 'x' } })?.publicName).toBe(true);
    expect(memberDoc({ ...base, consent: { version: 'x' }, hideNameInRsvp: true })?.publicName).toBe(false);
    expect(memberDoc(base)?.publicName).toBe(false);
  });
  it('släpper bara igenom https-bilder', () => {
    expect(memberDoc({ displayName: 'A', permissions: ['member'], photoUrl: 'http://x/a.jpg' })?.photoUrl).toBeUndefined();
    expect(memberDoc({ displayName: 'A', permissions: ['member'], photoUrl: 'https://x/a.jpg', avatarColor: 'plum' })).toMatchObject({ photoUrl: 'https://x/a.jpg', avatarColor: 'plum' });
  });
});

import { describe, expect, it } from 'vitest';
import { cleanMessage, isSafeLink, isUnread, pairId, previewText } from '../../src/lib/messages';

describe('messages', () => {
  it('pairId är lika åt båda håll', () => {
    expect(pairId('b', 'a')).toBe('a_b');
    expect(pairId('a', 'b')).toBe('a_b');
  });
  it('oläst bara när den andra skrev sist och efter min läsning', () => {
    const t = (s: number) => new Date(s * 1000);
    expect(isUnread('me', { lastSenderUid: 'me', lastMessageAt: t(5), readAt: null })).toBe(false);
    expect(isUnread('me', { lastSenderUid: 'x', lastMessageAt: t(5), readAt: null })).toBe(true);
    expect(isUnread('me', { lastSenderUid: 'x', lastMessageAt: t(5), readAt: t(3) })).toBe(true);
    expect(isUnread('me', { lastSenderUid: 'x', lastMessageAt: t(5), readAt: t(5) })).toBe(false);
    expect(isUnread('me', { lastSenderUid: 'x', lastMessageAt: null, readAt: t(5) })).toBe(false);
  });
  it('cleanMessage: trimmar, nekar tomt och för långt, släpper igenom emojis', () => {
    expect(cleanMessage('  hej 👋 ')).toBe('hej 👋');
    expect(cleanMessage('   ')).toBeNull();
    expect(cleanMessage('x'.repeat(1001))).toBeNull();
  });
  it('previewText: en rad, högst 200 enheter', () => {
    expect(previewText('a\n\nb   c')).toBe('a b c');
    expect(previewText('👍'.repeat(300)).length).toBe(200);
    expect(previewText('a'.repeat(300)).length).toBe(200);
  });
  it('isSafeLink: bara adresser på sajten', () => {
    expect(isSafeLink('/profil')).toBe(true);
    for (const bad of ['//evil.com', 'https://evil.com', 'javascript:alert(1)', '', '/', 5]) expect(isSafeLink(bad)).toBe(false);
  });
});

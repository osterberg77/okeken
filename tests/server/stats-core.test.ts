import { describe, expect, it } from 'vitest';
import { isBot, normalizeFile, normalizePath, parseHit, referrerSource, statsDocId } from '../../functions/src/stats-core';

describe('stats-core', () => {
  it('normaliserar sidadressen', () => {
    expect(normalizePath('/event/2026-10-27-tisdag.html?x=1#a')).toBe('/event/2026-10-27-tisdag');
    expect(normalizePath('/om-klubben/')).toBe('/om-klubben');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('/index.html')).toBe('/');
  });
  it('räknar aldrig admin, inloggning, profil eller konstiga adresser', () => {
    for (const p of ['/admin', '/admin/events', '/logga-in', '/profil', 'http://x', '/a b', '/<script>', 42, '/' + 'a'.repeat(300)]) {
      expect(normalizePath(p)).toBeNull();
    }
  });
  it('ger bara värdnamnet som källa', () => {
    expect(referrerSource('', 'okeken.se')).toBe('direkt');
    expect(referrerSource('https://www.google.com/search?q=hemligt', 'okeken.se')).toBe('google.com');
    expect(referrerSource('https://l.facebook.com/l.php?u=x', 'okeken.se')).toBe('l.facebook.com');
    expect(referrerSource('https://okeken.se/x', 'okeken.se')).toBe('intern');
    expect(referrerSource('https://okeken.web.app/x', 'okeken.se')).toBe('intern');
    expect(referrerSource('inte en adress', 'okeken.se')).toBe('direkt');
  });
  it('känner igen botar', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1')).toBe(false);
  });
  it('godkänner bara filer med känd ändelse', () => {
    expect(normalizeFile('bana-1.pdf')).toBe('bana-1.pdf');
    expect(normalizeFile('a/b.pdf')).toBeNull();
    expect(normalizeFile('skript.js')).toBeNull();
  });
  it('tolkar anrop', () => {
    expect(parseHit({ t: 'pv', p: '/', r: 'https://google.com/' })).toEqual({ kind: 'pageview', path: '/', referrer: 'https://google.com/' });
    expect(parseHit({ t: 'dl', p: '/event/a', f: 'bana.pdf' })).toEqual({ kind: 'download', path: '/event/a', file: 'bana.pdf' });
    expect(parseHit({ t: 'dl', p: '/event/a', f: 'x.exe' })).toBeNull();
    expect(parseHit({ t: 'x', p: '/' })).toBeNull();
    expect(parseHit(null)).toBeNull();
  });
  it('gör dokument-id utan snedstreck och punkter', () => {
    expect(statsDocId('2026-10-22', '/event/a|bana.pdf')).not.toMatch(/[/.]/);
  });
});

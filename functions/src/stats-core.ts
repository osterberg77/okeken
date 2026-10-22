// Ren logik för besöksräknaren (ingen Firebase), så att den kan testas direkt. Se beslut 0014.

export type Hit =
  | { kind: 'pageview'; path: string; referrer: string }
  | { kind: 'download'; path: string; file: string };

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|curl|wget|python|go-http|node-fetch/i;

export const isBot = (userAgent: string | undefined) => !userAgent || BOT.test(userAgent);

/** Sidans adress utan fråga, ankare, `.html` och avslutande snedstreck. Admin och inloggning räknas aldrig. */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  const path = raw.split(/[?#]/)[0].replace(/(\/index)?\.html$/, '').replace(/(.)\/+$/, '$1') || '/';
  if (!/^\/[A-Za-z0-9/_.%~-]*$/.test(path)) return null;
  if (path === '/admin' || path.startsWith('/admin/') || path === '/logga-in' || path === '/profil') return null;
  return path;
}

/**
 * Varifrån besökaren kom: värdnamnet, `direkt` utan referens, `intern` från sajten själv.
 * Bara värdnamnet sparas (aldrig hela adressen med fråga eller sökord).
 */
export function referrerSource(raw: unknown, siteHost: string): string {
  if (typeof raw !== 'string' || raw === '' || raw.length > 500) return 'direkt';
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
    if (!host) return 'direkt';
    if (host === siteHost || host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')) return 'intern';
    return host.slice(0, 100);
  } catch {
    return 'direkt';
  }
}

const FILE = /^[^/\\]{1,200}\.(pdf|docx?|xlsx?|pptx?|zip|gpx|png|jpe?g)$/i;

export function normalizeFile(raw: unknown): string | null {
  return typeof raw === 'string' && FILE.test(raw) ? raw : null;
}

/** Tolkar innehållet i anropet från klientskriptet; null om det inte ser rätt ut */
export function parseHit(body: unknown): Hit | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const path = normalizePath(b.p);
  if (!path) return null;
  if (b.t === 'pv') return { kind: 'pageview', path, referrer: typeof b.r === 'string' ? b.r : '' };
  if (b.t === 'dl') {
    const file = normalizeFile(b.f);
    return file ? { kind: 'download', path, file } : null;
  }
  return null;
}

/** Dagens datum i Europe/Stockholm som ÅÅÅÅ-MM-DD (dokument-id och intervall i adminvyn) */
export function stockholmDay(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Dokument-id för en rad: datum + innehåll, utan snedstreck (som är förbjudna i id) */
export const statsDocId = (day: string, key: string) => `${day}__${encodeURIComponent(key).replace(/\./g, '%2E')}`;

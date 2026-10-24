import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { isBot, parseHit, referrerSource, statsDocId, stockholmDay } from './stats-core.js';

// Besöksräknaren (beslut 0014): klientskriptet skickar sidvisningar och nedladdningar hit via Hosting (/api/hit).
// Vi sparar bara räknare per dag och sida: aldrig IP, aldrig användaragent. Unika besökare räknas med en hash
// (IP + användaragent + dagens slumpade salt) som sparas i statsSeen och raderas av Firestores TTL.

const SITE_HOST = 'okeken.se';
const COUNTRY_HEADERS = ['x-appengine-country', 'x-country-code', 'cf-ipcountry', 'x-client-country'];

const saltCache = new Map<string, string>();

/** Dagens salt: slumpat, skapas första gången en dag behövs och lagras bara på serversidan */
async function dailySalt(day: string): Promise<string> {
  const cached = saltCache.get(day);
  if (cached) return cached;
  const ref = getFirestore().doc(`statsSeen/${day}__salt`);
  const fresh = randomBytes(16).toString('hex');
  try {
    await ref.create({ salt: fresh, expireAt: Timestamp.fromMillis(Date.now() + 3 * 86400_000) });
    saltCache.set(day, fresh);
    return fresh;
  } catch {
    const salt = (await ref.get()).data()?.salt as string | undefined;
    if (!salt) throw new Error('salt saknas');
    saltCache.set(day, salt);
    return salt;
  }
}

/** True första gången den här besökaren (hash) syns på den här sidan idag */
async function firstVisitToday(day: string, path: string, ip: string, userAgent: string): Promise<boolean> {
  const salt = await dailySalt(day);
  const hash = createHash('sha256').update(`${salt}|${ip}|${userAgent}|${path}`).digest('hex').slice(0, 32);
  try {
    await getFirestore().doc(`statsSeen/${day}__${hash}`).create({ expireAt: Timestamp.fromMillis(Date.now() + 3 * 86400_000) });
    return true;
  } catch {
    return false;
  }
}

function country(headers: Record<string, string | string[] | undefined>): string {
  for (const name of COUNTRY_HEADERS) {
    const v = headers[name];
    const code = (Array.isArray(v) ? v[0] : v)?.toUpperCase();
    if (code && /^[A-Z]{2}$/.test(code) && code !== 'XX') return code;
  }
  return '??';
}

export const hit = onRequest({ region: 'europe-north1', cors: false, maxInstances: 3, memory: '256MiB' }, async (req, res) => {
  // Svara alltid snabbt och tyst; räknaren får aldrig störa sidan
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const userAgent = String(req.headers['user-agent'] ?? '');
  let body: unknown = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const parsed = parseHit(body);
  if (!parsed || isBot(userAgent)) {
    res.status(204).end();
    return;
  }

  const day = stockholmDay(new Date());
  const db = getFirestore();
  try {
    if (parsed.kind === 'pageview') {
      const forwarded = String(req.headers['x-forwarded-for'] ?? req.ip ?? '').split(',')[0].trim();
      const unique = await firstVisitToday(day, parsed.path, forwarded, userAgent);
      const source = referrerSource(parsed.referrer, SITE_HOST);
      // Räknare i nästlade fält: set + merge ökar bara det som nämns
      await db.doc(`statsPages/${statsDocId(day, parsed.path)}`).set(
        {
          date: day,
          path: parsed.path,
          views: FieldValue.increment(1),
          unique: FieldValue.increment(unique ? 1 : 0),
          // Av dem som var inloggade (andelen medlemmar bland besökarna)
          memberViews: FieldValue.increment(parsed.member ? 1 : 0),
          memberUnique: FieldValue.increment(parsed.member && unique ? 1 : 0),
          sources: { [source]: FieldValue.increment(1) },
          countries: { [country(req.headers)]: FieldValue.increment(1) },
        },
        { merge: true },
      );
    } else {
      await db.doc(`statsDownloads/${statsDocId(day, `${parsed.path}|${parsed.file}`)}`).set(
        { date: day, path: parsed.path, file: parsed.file, count: FieldValue.increment(1), memberCount: FieldValue.increment(parsed.member ? 1 : 0) },
        { merge: true },
      );
    }
  } catch (err) {
    console.error('Räknaren kunde inte spara', err);
  }
  res.status(204).end();
});

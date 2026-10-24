import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

// Självregistrering på träningar via QR-kod (beslut 0022). Alla anrop går genom Function `registerParticipation`, som
// skriver i events/{id}/results med Admin SDK. Reglerna för results är oförändrade: klienter skriver aldrig dit själva.

export class InvalidSelfResult extends Error {}
export class EventNotOpen extends Error {}
export class GuestLimitReached extends Error {}

export interface SelfResultRequest {
  slug: string;
  name: string;
  course: string;
  totalSeconds: number | null;
  show: 'time' | 'participated' | 'hidden';
  rating: number | null;
  /** Dolt fält som människor inte fyller i; ifyllt = bot */
  trap: string;
}

const stockholmDay = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(d);

/** Öppen hela startdagen till och med hela slutdagen (svensk tid); klockslagen räknas inte. Spegel i src/components/SelfRegister.tsx. */
export function isRegistrationOpen(startsAt: Date, endsAt: Date, now: Date): boolean {
  const today = stockholmDay(now);
  return stockholmDay(startsAt) <= today && today <= stockholmDay(endsAt);
}

/** Tak för gästregistreringar per träning (skydd mot skräp; publiceringen är ändå manuell) */
export const MAX_GUEST_ROWS = 150;

export function parseSelfResult(data: unknown): SelfResultRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const slug = str(d.slug, 120);
  if (!/^[A-Za-z0-9-]{1,120}$/.test(slug)) throw new InvalidSelfResult('slug');
  const show = d.show;
  if (show !== 'time' && show !== 'participated' && show !== 'hidden') throw new InvalidSelfResult('show');
  const total = d.totalSeconds;
  if (total !== null && total !== undefined && !(typeof total === 'number' && Number.isInteger(total) && total >= 0 && total <= 86400)) {
    throw new InvalidSelfResult('totalSeconds');
  }
  const rating = d.rating;
  if (rating !== null && rating !== undefined && !(typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    throw new InvalidSelfResult('rating');
  }
  return {
    slug,
    name: str(d.name, 100),
    course: str(d.course, 100),
    totalSeconds: typeof total === 'number' ? total : null,
    show,
    rating: typeof rating === 'number' ? rating : null,
    trap: str(d.trap, 100),
  };
}

/** "Visa tid" utan tid blir "bara deltagit" (annars skulle raden aldrig synas) */
export const effectiveShow = (r: Pick<SelfResultRequest, 'show' | 'totalSeconds'>) =>
  r.show === 'time' && r.totalSeconds === null ? 'participated' : r.show;

/** Registrerar deltagande. Medlem (uid med behörighet): en rad per träning med uid som id, som kan skrivas över. Gäst: ny rad. */
export async function registerParticipation(db: Firestore, req: SelfResultRequest, uid: string | null, now = new Date()): Promise<{ updated: boolean }> {
  if (req.trap) return { updated: false }; // bot: svara som om det gick bra
  const events = await db.collection('events').where('slug', '==', req.slug).where('status', '==', 'published').limit(1).get();
  const event = events.docs[0];
  const p = event?.data().published;
  if (!event || !p || p.type !== 'training' || event.data().resultsEnabled === false) throw new EventNotOpen('event');
  if (!isRegistrationOpen((p.startsAt as Timestamp).toDate(), (p.endsAt as Timestamp).toDate(), now)) throw new EventNotOpen('window');

  const results = db.collection(`events/${event.id}/results`);
  const member = uid ? (await db.doc(`users/${uid}`).get()).data() : undefined;
  const isMember = Array.isArray(member?.permissions) && member.permissions.length > 0;
  const common = {
    course: req.course,
    totalSeconds: req.totalSeconds,
    show: effectiveShow(req),
    rating: req.rating,
  };

  if (uid && isMember) {
    const ref = results.doc(uid);
    const existing = await ref.get();
    const name = typeof member?.displayName === 'string' && member.displayName.trim() ? member.displayName.trim() : req.name;
    if (!name) throw new InvalidSelfResult('name');
    if (existing.exists) {
      await ref.update({ ...common, name, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() });
      return { updated: true };
    }
    await ref.set({
      ...common, name, memberUid: uid, source: 'member', startAt: null, finishAt: null, youth: false,
      createdBy: uid, createdAt: FieldValue.serverTimestamp(), updatedBy: uid, updatedAt: FieldValue.serverTimestamp(),
    });
    return { updated: false };
  }

  if (!req.name) throw new InvalidSelfResult('name');
  const guests = await results.where('source', '==', 'guest').count().get();
  if (guests.data().count >= MAX_GUEST_ROWS) throw new GuestLimitReached('limit');
  await results.add({
    ...common, name: req.name, memberUid: null, source: 'guest', startAt: null, finishAt: null, youth: false,
    createdBy: 'guest', createdAt: FieldValue.serverTimestamp(), updatedBy: 'guest', updatedAt: FieldValue.serverTimestamp(),
  });
  return { updated: false };
}

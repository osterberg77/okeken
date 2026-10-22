import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { publishDueEvents } from '../../functions/src/scheduled-publish';

// Körs mot Firestore-emulatorn (npm run test:rules sätter miljövariablerna).
const app = getApps()[0] ?? initializeApp({ projectId: 'demo-okeken' });
const db = getFirestore(app);
const events = db.collection('events');

const draft = (over: Record<string, unknown> = {}) => ({
  type: 'training',
  title: 'Tisdagsträning vecka 44',
  startsAt: Timestamp.fromDate(new Date('2026-10-27T16:00:00Z')),
  endsAt: Timestamp.fromDate(new Date('2026-11-01T11:00:00Z')),
  location: { name: 'Skogen', mapUrl: '' },
  body: 'Hej',
  courseSetter: 'Anna',
  livelox: '',
  courseFiles: [],
  image: null,
  publisher: 'uid1',
  status: 'draft',
  slug: null,
  published: null,
  publishedAt: null,
  source: 'manual',
  createdBy: 'u',
  createdAt: Timestamp.now(),
  updatedBy: 'u',
  updatedAt: Timestamp.now(),
  ...over,
});

const NOW = new Date('2026-10-22T12:00:00Z');
const at = (iso: string) => Timestamp.fromDate(new Date(iso));

async function clear() {
  for (const d of (await events.get()).docs) await d.ref.delete();
}
beforeEach(clear);
afterAll(clear);

describe('publishDueEvents', () => {
  it('publicerar ett utkast vars tid passerat och tömmer publishAt', async () => {
    await events.doc('a').set(draft({ publishAt: at('2026-10-22T11:50:00Z') }));
    expect(await publishDueEvents(db, NOW)).toEqual(['a']);
    const d = (await events.doc('a').get()).data()!;
    expect(d.status).toBe('published');
    expect(d.slug).toBe('2026-10-27-tisdagstraning-vecka-44');
    expect(d.publishAt).toBeNull();
    expect(d.publishedAt).toBeTruthy();
    expect(d.published).toMatchObject({ title: 'Tisdagsträning vecka 44', body: 'Hej', publisher: 'uid1', image: null, courseFiles: [] });
    // Ögonblicksbilden innehåller bara innehållsfälten
    expect(Object.keys(d.published).sort()).toEqual(
      ['body', 'courseFiles', 'courseSetter', 'endsAt', 'image', 'livelox', 'location', 'publisher', 'startsAt', 'title', 'type'],
    );
  });

  it('rör inte events som ska publiceras senare eller saknar schema', async () => {
    await events.doc('later').set(draft({ publishAt: at('2026-10-22T12:30:00Z') }));
    await events.doc('none').set(draft());
    expect(await publishDueEvents(db, NOW)).toEqual([]);
    expect((await events.doc('later').get()).data()!.status).toBe('draft');
  });

  it('behåller adressen på ett redan publicerat event och publicerar ändringarna', async () => {
    await events.doc('p').set(
      draft({ status: 'published', slug: 'gammal-adress', title: 'Ny titel', published: { title: 'Gammal titel' }, publishAt: at('2026-10-22T11:00:00Z') }),
    );
    await publishDueEvents(db, NOW);
    const d = (await events.doc('p').get()).data()!;
    expect(d.slug).toBe('gammal-adress');
    expect(d.published.title).toBe('Ny titel');
  });

  it('ger en ledig adress när två events får samma', async () => {
    await events.doc('x').set(draft({ status: 'published', slug: '2026-10-27-tisdagstraning-vecka-44', published: { title: 'x' } }));
    await events.doc('y').set(draft({ publishAt: at('2026-10-22T11:00:00Z') }));
    await publishDueEvents(db, NOW);
    expect((await events.doc('y').get()).data()!.slug).toBe('2026-10-27-tisdagstraning-vecka-44-2');
  });
});

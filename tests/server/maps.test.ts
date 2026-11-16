import { beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { markMapJobFailed, parseMapSource, queueMapJob } from '../../functions/src/maps';

// Körs mot Firestore-emulatorn (npm run test:rules sätter miljövariablerna).
const app = getApps()[0] ?? initializeApp({ projectId: 'demo-okeken', storageBucket: 'demo-okeken.appspot.com' });
const db = getFirestore(app);

describe('parseMapSource', () => {
  it('läser kart-id och filnamn', () => {
    expect(parseMapSource('map_sources/botorp/1763300000000-Kartbas_Botorp_25.omap')).toEqual({
      mapId: 'botorp',
      sourcePath: 'map_sources/botorp/1763300000000-Kartbas_Botorp_25.omap',
      sourceName: 'Kartbas_Botorp_25.omap',
    });
  });
  it('tar .ocd', () => expect(parseMapSource('map_sources/atvid/1763300000000-a.ocd')?.mapId).toBe('atvid'));
  it('ignorerar andra filer', () => {
    expect(parseMapSource('courses/ev1/x.pdf')).toBeNull();
    expect(parseMapSource('map_tiles/botorp/abc/1/2/3.png')).toBeNull();
    expect(parseMapSource('map_sources/botorp/karta.omap')).toBeNull();
    expect(parseMapSource('map_sources/botorp/1763300000000-a.pdf')).toBeNull();
    expect(parseMapSource(undefined)).toBeNull();
  });
});

describe('queueMapJob / markMapJobFailed', () => {
  const ref = db.doc('maps/testkarta');
  beforeEach(async () => {
    await ref.set({ name: 'Test', current: { version: 'v1' } });
  });

  it('köar jobbet och behåller current', async () => {
    const src = parseMapSource('map_sources/testkarta/1763300000000-a.omap')!;
    expect(await queueMapJob(db, src)).toBe(true);
    const d = (await ref.get()).data()!;
    expect(d.job.status).toBe('queued');
    expect(d.job.sourceName).toBe('a.omap');
    expect(d.current.version).toBe('v1');
  });

  it('karta som saknas köas inte', async () => {
    expect(await queueMapJob(db, parseMapSource('map_sources/finns-inte/1763300000000-a.omap')!)).toBe(false);
    expect((await db.doc('maps/finns-inte').get()).exists).toBe(false);
  });

  it('fel markeras bara på senaste uppladdningen', async () => {
    const first = parseMapSource('map_sources/testkarta/1763300000000-a.omap')!;
    const second = parseMapSource('map_sources/testkarta/1763300000001-b.omap')!;
    await queueMapJob(db, first);
    await queueMapJob(db, second);
    await markMapJobFailed(db, first, 'gammalt fel');
    expect((await ref.get()).data()!.job.status).toBe('queued');
    await markMapJobFailed(db, second, 'nytt fel');
    const job = (await ref.get()).data()!.job;
    expect(job.status).toBe('failed');
    expect(job.error).toBe('nytt fel');
  });
});

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const USERS: Record<string, string[]> = {
  publisher: ['publisher'],
  board: ['board'],
  super: ['superadmin'],
  member: ['member'],
  setter: ['course_setter'],
  nobody: [],
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Eget projekt-id så att parallella testfiler inte rensar varandras data
    projectId: 'demo-okeken-events',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

const T1 = Timestamp.fromDate(new Date('2026-06-01T17:00:00Z'));
const T2 = Timestamp.fromDate(new Date('2026-06-01T19:00:00Z'));
const OLD = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));

const content = () => ({
  type: 'training',
  title: 'Tisdagsträning',
  startsAt: T1,
  endsAt: T2,
  location: { name: 'Skogen', mapUrl: '' },
  body: 'Hej',
  courseSetter: '',
  livelox: '',
});

const draftDoc = () => ({
  ...content(),
  status: 'draft',
  slug: null,
  published: null,
  publishedAt: null,
  source: 'manual',
  createdBy: 'publisher',
  createdAt: OLD,
  updatedBy: 'publisher',
  updatedAt: OLD,
});

const publishedDoc = () => ({
  ...draftDoc(),
  status: 'published',
  slug: 'tisdagstraning',
  published: content(),
  publishedAt: OLD,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, permissions] of Object.entries(USERS)) {
      await setDoc(doc(db, 'users', uid), {
        displayName: uid,
        email: `${uid}@example.com`,
        permissions,
        createdAt: Timestamp.now(),
      });
    }
    await setDoc(doc(db, 'events', 'draft1'), draftDoc());
    await setDoc(doc(db, 'events', 'draft2'), draftDoc());
    await setDoc(doc(db, 'events', 'pub1'), publishedDoc());
    await setDoc(doc(db, 'events', 'unpub1'), { ...publishedDoc(), status: 'unpublished' });
  });
});

const as = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
// Användare utan users-dokument
const ghost = () =>
  env.authenticatedContext('ghost', { email: 'ghost@example.com', email_verified: true }).firestore();

const ev = (db: ReturnType<typeof as>, id: string) => doc(db, 'events', id);

const newEvent = (uid = 'publisher', over: Record<string, unknown> = {}) => ({
  ...content(),
  status: 'draft',
  slug: null,
  published: null,
  publishedAt: null,
  source: 'manual',
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedBy: uid,
  updatedAt: serverTimestamp(),
  ...over,
});

const save = (id: string, over: Record<string, unknown>, uid = 'publisher') =>
  updateDoc(ev(as(uid), id), { updatedBy: uid, updatedAt: serverTimestamp(), ...over });

describe('events: read', () => {
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} kan läsa (get och list)`, async () => {
      await assertSucceeds(getDoc(ev(as(uid), 'draft1')));
      await assertSucceeds(getDocs(collection(as(uid), 'events')));
    });
  }
  for (const uid of ['member', 'setter', 'nobody']) {
    it(`${uid} kan inte läsa`, async () => {
      await assertFails(getDoc(ev(as(uid), 'draft1')));
      await assertFails(getDocs(collection(as(uid), 'events')));
    });
  }
  it('användare utan dokument kan inte läsa', async () => {
    await assertFails(getDoc(ev(ghost(), 'draft1')));
    await assertFails(getDocs(collection(ghost(), 'events')));
  });
  it('oinloggad kan inte läsa', async () => {
    await assertFails(getDoc(ev(anon(), 'draft1')));
    await assertFails(getDocs(collection(anon(), 'events')));
  });
});

describe('events: create', () => {
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} kan skapa giltigt utkast`, async () => {
      await assertSucceeds(setDoc(ev(as(uid), 'new'), newEvent(uid)));
    });
  }
  for (const uid of ['member', 'setter', 'nobody']) {
    it(`${uid} kan inte skapa`, async () => {
      await assertFails(setDoc(ev(as(uid), 'new'), newEvent(uid)));
    });
  }
  it('användare utan dokument och oinloggad kan inte skapa', async () => {
    await assertFails(setDoc(ev(ghost(), 'new'), newEvent('ghost')));
    await assertFails(setDoc(ev(anon(), 'new'), newEvent('publisher')));
  });

  const denied: [string, Record<string, unknown>][] = [
    ['status published', { status: 'published' }],
    ['status unpublished', { status: 'unpublished' }],
    ['slug satt', { slug: 'abc' }],
    ['published satt', { published: content() }],
    ['publishedAt satt', { publishedAt: serverTimestamp() }],
    ['source annat än manual', { source: 'import' }],
    ['createdBy annan användare', { createdBy: 'board' }],
    ['updatedBy annan användare', { updatedBy: 'board' }],
    ['createdAt inte serverTimestamp', { createdAt: OLD }],
    ['updatedAt inte serverTimestamp', { updatedAt: OLD }],
    ['ogiltig type', { type: 'party' }],
    ['tom title', { title: '' }],
    ['title över 200 tecken', { title: 'x'.repeat(201) }],
    ['title inte sträng', { title: 5 }],
    ['startsAt inte timestamp', { startsAt: '2026-06-01' }],
    ['endsAt före startsAt', { endsAt: Timestamp.fromDate(new Date('2026-06-01T10:00:00Z')) }],
    ['location med extra nyckel', { location: { name: 'a', mapUrl: '', extra: 'x' } }],
    ['location saknar mapUrl', { location: { name: 'a' } }],
    ['location.name inte sträng', { location: { name: 1, mapUrl: '' } }],
    ['location inte map', { location: 'Skogen' }],
    ['body över 20000 tecken', { body: 'x'.repeat(20001) }],
    ['courseSetter över 200 tecken', { courseSetter: 'x'.repeat(201) }],
    ['livelox över 500 tecken', { livelox: 'x'.repeat(501) }],
  ];
  for (const [name, over] of denied) {
    it(`nekas: ${name}`, async () => {
      await assertFails(setDoc(ev(as('publisher'), 'new'), newEvent('publisher', over)));
    });
  }

  it('gränsvärden accepteras', async () => {
    await assertSucceeds(
      setDoc(
        ev(as('publisher'), 'edge'),
        newEvent('publisher', {
          title: 'x'.repeat(200),
          body: 'x'.repeat(20000),
          courseSetter: 'x'.repeat(200),
          livelox: 'x'.repeat(500),
          endsAt: T1,
        }),
      ),
    );
  });

  it('saknad nyckel nekas', async () => {
    for (const key of Object.keys(newEvent())) {
      const data: Record<string, unknown> = newEvent();
      delete data[key];
      await assertFails(setDoc(ev(as('publisher'), `m-${key}`), data));
    }
  });
  it('extra nyckel nekas', async () => {
    await assertFails(setDoc(ev(as('publisher'), 'new'), newEvent('publisher', { extra: 1 })));
  });
});

describe('events: update - utkast', () => {
  it('spara utkastfält med updatedBy/updatedAt tillåts', async () => {
    await assertSucceeds(save('draft1', { title: 'Ny titel', body: 'Ny text' }));
  });
  it('board och superadmin kan uppdatera, med eget uid', async () => {
    await assertSucceeds(save('draft1', { title: 'B' }, 'board'));
    await assertSucceeds(save('draft1', { title: 'S' }, 'super'));
  });
  it('member och setter kan inte uppdatera', async () => {
    await assertFails(save('draft1', { title: 'X' }, 'member'));
    await assertFails(save('draft1', { title: 'X' }, 'setter'));
  });
  it('oinloggad kan inte uppdatera', async () => {
    await assertFails(
      updateDoc(ev(anon(), 'draft1'), { title: 'X', updatedBy: 'publisher', updatedAt: serverTimestamp() }),
    );
  });
  it('annan updatedBy nekas', async () => {
    await assertFails(save('draft1', { updatedBy: 'board' }));
  });
  it('updatedAt som inte är serverTimestamp nekas', async () => {
    await assertFails(save('draft1', { updatedAt: OLD }));
  });
  it('ändra createdBy / createdAt / source nekas', async () => {
    await assertFails(save('draft1', { createdBy: 'board' }));
    await assertFails(save('draft1', { createdAt: serverTimestamp() }));
    await assertFails(save('draft1', { source: 'import' }));
  });
  it('ogiltigt innehåll nekas', async () => {
    await assertFails(save('draft1', { title: '' }));
    await assertFails(save('draft1', { type: 'party' }));
  });
  it('extra nyckel nekas', async () => {
    await assertFails(save('draft1', { extra: 1 }));
  });
  it('draft med slug eller published nekas', async () => {
    await assertFails(save('draft1', { slug: 'abc' }));
    await assertFails(save('draft1', { published: content() }));
  });
  it('okänd status nekas', async () => {
    await assertFails(save('draft1', { status: 'archived' }));
  });
});

describe('events: update - publicering', () => {
  const publish = (over: Record<string, unknown> = {}, id = 'draft1') =>
    save(id, {
      status: 'published',
      slug: 'tisdagstraning',
      published: content(),
      publishedAt: serverTimestamp(),
      ...over,
    });

  it('publicera tillåts', async () => {
    await assertSucceeds(publish());
  });
  it('publicera tillåts även med ändrade utkastfält om snapshot matchar', async () => {
    await assertSucceeds(
      publish({ title: 'Ny', published: { ...content(), title: 'Ny' } }),
    );
  });
  it('board kan publicera', async () => {
    await assertSucceeds(
      save(
        'draft1',
        { status: 'published', slug: 'a', published: content(), publishedAt: serverTimestamp() },
        'board',
      ),
    );
  });
  it('member kan inte publicera', async () => {
    await assertFails(
      save(
        'draft1',
        { status: 'published', slug: 'a', published: content(), publishedAt: serverTimestamp() },
        'member',
      ),
    );
  });
  it('snapshot som skiljer sig från utkastet nekas', async () => {
    await assertFails(publish({ published: { ...content(), title: 'Annan' } }));
    await assertFails(publish({ published: { ...content(), body: 'Annan' } }));
    await assertFails(publish({ published: { ...content(), location: { name: 'Annan', mapUrl: '' } } }));
  });
  it('snapshot med extra eller saknade fält nekas', async () => {
    await assertFails(publish({ published: { ...content(), extra: 1 } }));
    const { livelox: _l, ...partial } = content();
    await assertFails(publish({ published: partial }));
  });
  it('publishedAt som inte är serverTimestamp nekas', async () => {
    await assertFails(publish({ publishedAt: OLD }));
  });
  for (const slug of ['Tisdag', 'med mellanslag', 'dubbel--bindestreck', '-ledande', 'avslutande-', '', 'x'.repeat(121)]) {
    it(`ogiltig slug nekas: "${slug.slice(0, 20)}"`, async () => {
      await assertFails(publish({ slug }));
    });
  }
  it('giltiga slugs tillåts', async () => {
    await assertSucceeds(publish({ slug: 'a-b-c-2026' }));
    await assertSucceeds(publish({ slug: 'x'.repeat(120) }, 'draft2'));
  });
  it('slug null vid publicering nekas', async () => {
    await assertFails(publish({ slug: null }));
  });
  it('status published utan published-map nekas', async () => {
    await assertFails(save('draft1', { status: 'published', slug: 'abc' }));
    await assertFails(save('draft1', { status: 'published', slug: 'abc', published: null }));
  });
});

describe('events: update - efter publicering', () => {
  it('redigera utkast och behålla gammal published tillåts (opublicerade ändringar)', async () => {
    await assertSucceeds(save('pub1', { title: 'Ändrad', body: 'Ändrad text' }));
  });
  it('ändra slug efter publishedAt nekas', async () => {
    await assertFails(save('pub1', { slug: 'ny-adress' }));
    await assertFails(save('unpub1', { slug: 'ny-adress' }));
  });
  it('slug null efter publicering nekas', async () => {
    await assertFails(save('pub1', { slug: null }));
  });
  it('publicera om med ny snapshot tillåts', async () => {
    const next = { ...content(), title: 'Ny titel' };
    await assertSucceeds(
      save('pub1', { title: 'Ny titel', published: next, publishedAt: serverTimestamp() }),
    );
  });
  it('publicera om med snapshot som inte matchar utkastet nekas', async () => {
    await assertFails(
      save('pub1', { title: 'Ny titel', published: content(), publishedAt: serverTimestamp() }),
    );
  });
  it('publicera om med ny slug nekas', async () => {
    await assertFails(
      save('pub1', { slug: 'annan', published: content(), publishedAt: serverTimestamp() }),
    );
  });
  it('publicera om utan serverTimestamp på publishedAt nekas', async () => {
    const next = { ...content(), title: 'Ny titel' };
    await assertFails(save('pub1', { title: 'Ny titel', published: next, publishedAt: OLD }));
  });
  it('ändra published utan att röra publishedAt nekas', async () => {
    await assertFails(save('pub1', { published: { ...content(), title: 'Smyg' } }));
  });
  it('ändra bara publishedAt nekas (snapshot måste vara serverstämplad kopia av utkastet)', async () => {
    await assertSucceeds(save('pub1', { publishedAt: serverTimestamp() })); // snapshot == utkast, tillåtet
    await assertFails(save('pub1', { publishedAt: OLD }));
  });

  it('avpublicera: published -> unpublished tillåts', async () => {
    await assertSucceeds(save('pub1', { status: 'unpublished' }));
  });
  it('återpublicera: unpublished -> published tillåts', async () => {
    await assertSucceeds(save('unpub1', { status: 'published' }));
  });
  it('status tillbaka till draft på publicerat event nekas', async () => {
    await assertFails(save('pub1', { status: 'draft' }));
    await assertFails(save('unpub1', { status: 'draft' }));
    await assertFails(save('pub1', { status: 'draft', slug: null, published: null }));
  });
  it('okänd status nekas', async () => {
    await assertFails(save('pub1', { status: 'archived' }));
    await assertFails(save('pub1', { status: '' }));
  });
  it('member kan inte avpublicera', async () => {
    await assertFails(save('pub1', { status: 'unpublished' }, 'member'));
  });
  it('ändra createdBy / source på publicerat nekas', async () => {
    await assertFails(save('pub1', { createdBy: 'board' }));
    await assertFails(save('pub1', { source: 'import' }));
  });
});

describe('events: delete', () => {
  it('publisher/board/super kan radera aldrig publicerat utkast', async () => {
    for (const uid of ['publisher', 'board', 'super']) {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', `d-${uid}`), draftDoc());
      });
      await assertSucceeds(deleteDoc(ev(as(uid), `d-${uid}`)));
    }
  });
  it('publicerat event kan inte raderas', async () => {
    await assertFails(deleteDoc(ev(as('publisher'), 'pub1')));
    await assertFails(deleteDoc(ev(as('super'), 'pub1')));
  });
  it('avpublicerat event kan inte raderas', async () => {
    await assertFails(deleteDoc(ev(as('publisher'), 'unpub1')));
  });
  it('icke-publicerare kan inte radera utkast', async () => {
    await assertFails(deleteDoc(ev(as('member'), 'draft1')));
    await assertFails(deleteDoc(ev(as('setter'), 'draft1')));
    await assertFails(deleteDoc(ev(as('nobody'), 'draft1')));
    await assertFails(deleteDoc(ev(ghost(), 'draft1')));
    await assertFails(deleteDoc(ev(anon(), 'draft1')));
  });
});

describe('meta/build', () => {
  const build = (db: ReturnType<typeof as>) => doc(db, 'meta', 'build');

  it('publicerare, styrelse och superadmin kan läsa', async () => {
    for (const uid of ['publisher', 'board', 'super']) {
      await assertSucceeds(getDoc(build(as(uid))));
    }
  });
  it('övriga kan inte läsa', async () => {
    for (const db of [as('member'), as('setter'), as('nobody'), ghost(), anon()]) {
      await assertFails(getDoc(build(db)));
    }
  });
  it('ingen kan skriva från klienten, inte ens superadmin', async () => {
    for (const db of [as('publisher'), as('board'), as('super'), as('member'), anon()]) {
      await assertFails(setDoc(build(db), { lastBuildAt: serverTimestamp() }));
    }
  });
});

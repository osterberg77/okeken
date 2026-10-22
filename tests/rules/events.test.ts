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
  deleteField,
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
  courseFiles: [],
  image: null,
  publisher: null,
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
  for (const uid of ['publisher', 'board', 'super', 'setter']) {
    it(`${uid} kan läsa (get och list)`, async () => {
      await assertSucceeds(getDoc(ev(as(uid), 'draft1')));
      await assertSucceeds(getDocs(collection(as(uid), 'events')));
    });
  }
  for (const uid of ['member', 'nobody']) {
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
    ['lat utan lng', { location: { name: 'a', mapUrl: '', lat: 58.2 } }],
    ['lat utanför intervallet', { location: { name: 'a', mapUrl: '', lat: 91, lng: 16 } }],
    ['lng som sträng', { location: { name: 'a', mapUrl: '', lat: 58.2, lng: '16' } }],
    ['body över 20000 tecken', { body: 'x'.repeat(20001) }],
    ['courseSetter över 200 tecken', { courseSetter: 'x'.repeat(201) }],
    ['livelox över 500 tecken', { livelox: 'x'.repeat(501) }],
  ];
  for (const [name, over] of denied) {
    it(`nekas: ${name}`, async () => {
      await assertFails(setDoc(ev(as('publisher'), 'new'), newEvent('publisher', over)));
    });
  }

  it('koordinater (lat/lng som par) accepteras', async () => {
    await assertSucceeds(
      setDoc(ev(as('publisher'), 'coords'), newEvent('publisher', { location: { name: 'a', mapUrl: '', lat: 58.2025, lng: 16.0015 } })),
    );
  });

  it('livelox och mapUrl måste vara https-adresser (eller tomma)', async () => {
    await assertFails(setDoc(ev(as('publisher'), 'badlx'), newEvent('publisher', { livelox: 'javascript:alert(1)' })));
    await assertFails(setDoc(ev(as('publisher'), 'badlx2'), newEvent('publisher', { livelox: 'http://example.com' })));
    await assertSucceeds(setDoc(ev(as('publisher'), 'oklx'), newEvent('publisher', { livelox: 'https://www.livelox.com/Events/Show/1' })));
  });

  it('gränsvärden accepteras', async () => {
    await assertSucceeds(
      setDoc(
        ev(as('publisher'), 'edge'),
        newEvent('publisher', {
          title: 'x'.repeat(200),
          body: 'x'.repeat(20000),
          courseSetter: 'x'.repeat(200),
          livelox: 'https://' + 'x'.repeat(492),
          endsAt: T1,
        }),
      ),
    );
  });

  it('saknad nyckel nekas', async () => {
    // courseFiles, image och publisher är valfria (äldre events saknar dem)
    for (const key of Object.keys(newEvent()).filter((k) => !['courseFiles', 'image', 'publisher'].includes(k))) {
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

describe('events: courseFiles (PDF-banor)', () => {
  const file = (over: Record<string, unknown> = {}, id = 'draft1') => ({
    name: 'Bana A.pdf',
    storagePath: `courses/${id}/0b1c2d3e-Bana-A.pdf`,
    label: 'Bana A',
    ...over,
  });

  it('publicerare kan spara och publicera banor', async () => {
    await assertSucceeds(save('draft1', { courseFiles: [file(), file({ storagePath: 'courses/draft1/x-B.pdf' })] }));
    const c = { ...content(), courseFiles: [file({}, 'draft2')] };
    await assertSucceeds(
      save('draft2', { ...c, status: 'published', slug: 'med-bana', published: c, publishedAt: serverTimestamp() }),
    );
  });
  it('publicerade banor måste vara samma som utkastet', async () => {
    const c = { ...content(), courseFiles: [file({}, 'draft2')] };
    await assertFails(
      save('draft2', { ...c, status: 'published', slug: 'med-bana', published: content(), publishedAt: serverTimestamp() }),
    );
  });
  it('event utan courseFiles (skapade före funktionen) kan sparas och publiceras', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { courseFiles: _omit, ...legacy } = draftDoc() as Record<string, unknown>;
      await setDoc(doc(ctx.firestore(), 'events', 'legacy'), legacy);
    });
    await assertSucceeds(save('legacy', { title: 'Ny titel' }));
    const c = { ...content(), title: 'Ny titel', courseFiles: [] };
    await assertSucceeds(
      save('legacy', { ...c, status: 'published', slug: 'gammalt', published: c, publishedAt: serverTimestamp() }),
    );
  });
  it('nytt event utan courseFiles får skapas', async () => {
    const { courseFiles: _omit, ...c } = newEvent() as Record<string, unknown>;
    await assertSucceeds(setDoc(ev(as('publisher'), 'nytt'), c));
  });
  it('ogiltiga banor nekas', async () => {
    await assertFails(save('draft1', { courseFiles: 'bana.pdf' }));
    await assertFails(save('draft1', { courseFiles: [file({ storagePath: 'courses/draft1/bana.exe' })] }));
    await assertFails(save('draft1', { courseFiles: [file({ storagePath: 'images/draft1/bana.pdf' })] }));
    await assertFails(save('draft1', { courseFiles: [file({ storagePath: 'courses/../secret/bana.pdf' })] }));
    await assertFails(save('draft1', { courseFiles: [file({ storagePath: 'https://evil.example/bana.pdf' })] }));
    await assertFails(save('draft1', { courseFiles: [file({ extra: 'x' })] }));
    await assertFails(save('draft1', { courseFiles: [file({ name: '' })] }));
    await assertFails(save('draft1', { courseFiles: [file({ label: 5 })] }));
    await assertFails(save('draft1', { courseFiles: [file(), 'text'] }));
    await assertFails(save('draft1', { courseFiles: null }));
    await assertFails(save('draft1', { courseFiles: [{ name: 'a.pdf', storagePath: 'courses/draft1/a.pdf' }] }));
    await assertFails(save('draft1', { courseFiles: [{ name: 'a.pdf', label: 'A' }] }));
    await assertFails(save('draft1', { courseFiles: [file({ storagePath: 'courses/draft1/..pdf' })] }));
  });
  it('längdgränser och typer i banposten', async () => {
    await assertSucceeds(save('draft1', { courseFiles: [file({ name: 'x'.repeat(200), label: 'y'.repeat(200) })] }));
    await assertSucceeds(save('draft1', { courseFiles: [file({ name: 'rad\nbrytning.pdf', label: '' })] }));
    await assertFails(save('draft1', { courseFiles: [file({ name: 'x'.repeat(201) })] }));
    await assertFails(save('draft1', { courseFiles: [file({ label: 'y'.repeat(201) })] }));
    await assertFails(save('draft1', { courseFiles: [file({ name: 5 })] }));
    await assertFails(save('draft1', { courseFiles: [file({ name: null })] }));
    await assertFails(save('draft1', { courseFiles: [file({ storagePath: 7 })] }));
    await assertFails(save('draft1', { courseFiles: [file({ storagePath: `courses/draft1/${'a'.repeat(197)}.pdf` })] }));
    await assertSucceeds(save('draft1', { courseFiles: [file({ storagePath: `courses/draft1/${'a'.repeat(196)}.pdf` })] }));
    await assertFails(save('draft1', { courseFiles: [42] }));
  });
  it('publicera 8 banor med maxlängder ryms under uttryckstaket', async () => {
    const big = Array.from({ length: 8 }, (_, i) =>
      file({ name: 'x'.repeat(200), label: 'y'.repeat(200), storagePath: `courses/draft2/${i}${'a'.repeat(195)}.pdf` }, 'draft2'),
    );
    const c = { ...content(), title: 't'.repeat(200), body: 'b'.repeat(20000), courseFiles: big };
    await assertSucceeds(
      save('draft2', { ...c, status: 'published', slug: 'x'.repeat(120), published: c, publishedAt: serverTimestamp() }),
    );
  });
  it('banor måste ligga under eventets egen mapp', async () => {
    await assertFails(save('draft1', { courseFiles: [file({}, 'draft2')] }));
    await assertSucceeds(save('draft1', { courseFiles: [file({}, 'draft1')] }));
  });
  it('högst 8 banor, och sjätte-åttonde kontrolleras också', async () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => file({ storagePath: `courses/draft1/f${i}.pdf` }));
    await assertSucceeds(save('draft1', { courseFiles: many(8) }));
    await assertFails(save('draft1', { courseFiles: many(9) }));
    await assertFails(save('draft1', { courseFiles: [...many(7), file({ storagePath: 'courses/draft1/x.exe' })] }));
  });
  it('övriga roller kan inte skriva banor', async () => {
    for (const uid of ['member', 'nobody']) {
      await assertFails(save('draft1', { courseFiles: [file()] }, uid));
    }
  });
});

describe('events: banläggare (courseFiles)', () => {
  const file = (id: string, n = 0) => ({
    name: `Bana ${n}.pdf`,
    storagePath: `courses/${id}/f${n}-Bana.pdf`,
    label: `Bana ${n}`,
  });
  const files = (id: string, count: number) => Array.from({ length: count }, (_, i) => file(id, i));
  // Bara banor (+ updatedBy/updatedAt), som banläggaren
  const saveFiles = (id: string, courseFiles: unknown, over: Record<string, unknown> = {}, uid = 'setter') =>
    save(id, { courseFiles, ...over }, uid);
  // Banor i både utkast och published (publicerat event)
  const syncFiles = (id: string, courseFiles: unknown, over: Record<string, unknown> = {}, uid = 'setter') =>
    save(id, { courseFiles, published: { ...content(), courseFiles }, ...over }, uid);

  it('kan spara banor på utkast', async () => {
    await assertSucceeds(saveFiles('draft1', [file('draft1')]));
    await assertSucceeds(saveFiles('draft1', []));
  });
  it('kan spara banor i utkastet på publicerat/avpublicerat event utan att röra published', async () => {
    await assertSucceeds(saveFiles('pub1', [file('pub1')]));
    await assertSucceeds(saveFiles('unpub1', [file('unpub1')]));
  });
  it('publicerat event: published.courseFiles får sättas lika med utkastets i samma skrivning', async () => {
    await assertSucceeds(syncFiles('pub1', [file('pub1'), file('pub1', 1)]));
    await assertSucceeds(syncFiles('pub1', []));
  });
  it('8 banor ryms (även synkade till published)', async () => {
    await assertSucceeds(syncFiles('pub1', files('pub1', 8)));
  });
  it('publicerat event utan courseFiles (äldre) kan få banor', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { courseFiles: _a, ...legacy } = publishedDoc() as Record<string, unknown>;
      const { courseFiles: _b, ...legacyPublished } = content() as Record<string, unknown>;
      await setDoc(doc(ctx.firestore(), 'events', 'legacyPub'), { ...legacy, published: legacyPublished });
    });
    const f = [file('legacyPub')];
    await assertSucceeds(save('legacyPub', { courseFiles: f, published: { ...content(), courseFiles: f } }, 'setter'));
  });

  it('published.courseFiles som skiljer sig från utkastets nekas', async () => {
    await assertFails(
      save('pub1', { courseFiles: [file('pub1')], published: { ...content(), courseFiles: [file('pub1', 1)] } }, 'setter'),
    );
    await assertFails(
      save('pub1', { courseFiles: [], published: { ...content(), courseFiles: [file('pub1')] } }, 'setter'),
    );
  });
  it('kan inte smuggla in annat i published', async () => {
    const f = [file('pub1')];
    await assertFails(save('pub1', { courseFiles: f, published: { ...content(), courseFiles: f, title: 'Smyg' } }, 'setter'));
    await assertFails(save('pub1', { courseFiles: f, published: { ...content(), courseFiles: f, extra: 1 } }, 'setter'));
    const { body: _b, ...noBody } = content();
    await assertFails(save('pub1', { courseFiles: f, published: { ...noBody, courseFiles: f } }, 'setter'));
    await assertFails(save('pub1', { published: { ...content(), title: 'Smyg' } }, 'setter'));
  });
  it('published får inte röras på utkast eller avpublicerat event', async () => {
    const f = [file('draft1')];
    await assertFails(save('draft1', { courseFiles: f, published: { ...content(), courseFiles: f } }, 'setter'));
    const g = [file('unpub1')];
    await assertFails(save('unpub1', { courseFiles: g, published: { ...content(), courseFiles: g } }, 'setter'));
  });
  it('kan inte ändra publishedAt, inte ens med serverTimestamp', async () => {
    await assertFails(syncFiles('pub1', [file('pub1')], { publishedAt: serverTimestamp() }));
    await assertFails(saveFiles('pub1', [file('pub1')], { publishedAt: serverTimestamp() }));
  });

  const denied: [string, Record<string, unknown>][] = [
    ['title', { title: 'Ny titel' }],
    ['body', { body: 'Ny text' }],
    ['courseSetter', { courseSetter: 'Jag' }],
    ['status', { status: 'unpublished' }],
    ['slug', { slug: 'ny-adress' }],
    ['createdBy', { createdBy: 'setter' }],
    ['okänt fält', { extra: 1 }],
  ];
  for (const [name, over] of denied) {
    it(`kan inte ändra ${name}`, async () => {
      await assertFails(saveFiles('pub1', [file('pub1')], over));
      await assertFails(saveFiles('draft1', [file('draft1')], over));
    });
  }
  it('kan inte avpublicera eller publicera', async () => {
    await assertFails(save('pub1', { status: 'unpublished' }, 'setter'));
    await assertFails(save('unpub1', { status: 'published' }, 'setter'));
    await assertFails(
      save(
        'draft1',
        { status: 'published', slug: 'smyg', published: content(), publishedAt: serverTimestamp() },
        'setter',
      ),
    );
  });
  it('kan inte publicera om hela utkastet (publishedAt + published)', async () => {
    await assertFails(
      save('pub1', { title: 'Ny', published: { ...content(), title: 'Ny' }, publishedAt: serverTimestamp() }, 'setter'),
    );
  });
  it('fler än 8 banor nekas', async () => {
    await assertFails(saveFiles('draft1', files('draft1', 9)));
    await assertFails(syncFiles('pub1', files('pub1', 9)));
  });
  it('fel prefix nekas (annat event, annan mapp, ej pdf)', async () => {
    await assertFails(saveFiles('draft1', [file('draft2')]));
    await assertFails(syncFiles('pub1', [file('draft1')]));
    await assertFails(saveFiles('draft1', [{ ...file('draft1'), storagePath: 'images/draft1/a.pdf' }]));
    await assertFails(saveFiles('draft1', [{ ...file('draft1'), storagePath: 'courses/draft1/a.html' }]));
    await assertFails(saveFiles('draft1', [...files('draft1', 7), file('draft2', 7)]));
  });
  it('ogiltiga eller borttagna courseFiles nekas', async () => {
    await assertFails(saveFiles('draft1', 'bana.pdf'));
    await assertFails(saveFiles('draft1', null));
    await assertFails(saveFiles('draft1', [{ ...file('draft1'), extra: 'x' }]));
    await assertFails(save('draft1', { courseFiles: deleteField() }, 'setter'));
  });
  it('måste sätta egen updatedBy och serverTimestamp', async () => {
    await assertFails(saveFiles('draft1', [file('draft1')], { updatedBy: 'publisher' }));
    await assertFails(saveFiles('draft1', [file('draft1')], { updatedAt: OLD }));
    await assertFails(
      updateDoc(ev(as('setter'), 'draft1'), { courseFiles: [file('draft1')] }),
    );
  });
  it('kan inte skapa eller radera events', async () => {
    await assertFails(setDoc(ev(as('setter'), 'new'), newEvent('setter')));
    await assertFails(deleteDoc(ev(as('setter'), 'draft1')));
    await assertFails(deleteDoc(ev(as('setter'), 'pub1')));
  });
  it('kan inte läsa meta/build eller pages', async () => {
    await assertFails(getDoc(doc(as('setter'), 'meta', 'build')));
    await assertFails(getDoc(doc(as('setter'), 'pages', 'p1')));
  });
  it('övriga roller kan inte använda banläggarvägen', async () => {
    for (const uid of ['member', 'nobody']) {
      await assertFails(saveFiles('pub1', [file('pub1')], {}, uid));
      await assertFails(syncFiles('pub1', [file('pub1')], {}, uid));
    }
    await assertFails(
      updateDoc(ev(ghost(), 'pub1'), { courseFiles: [file('pub1')], updatedBy: 'ghost', updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(ev(anon(), 'pub1'), { courseFiles: [file('pub1')], updatedBy: 'setter', updatedAt: serverTimestamp() }),
    );
  });
  it('publicerare kan inte synka published.courseFiles utan att publicera om (oförändrade rättigheter)', async () => {
    await assertFails(syncFiles('pub1', [file('pub1')], {}, 'publisher'));
    await assertSucceeds(saveFiles('pub1', [file('pub1')], {}, 'publisher'));
  });
  it('banläggare som också är publicerare får båda vägarna', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'both'), {
        displayName: 'both', email: 'both@example.com', permissions: ['course_setter', 'publisher'], createdAt: Timestamp.now(),
      });
    });
    await assertSucceeds(syncFiles('pub1', [file('pub1')], {}, 'both'));
    await assertSucceeds(syncFiles('pub1', files('pub1', 8), {}, 'both'));
    await assertSucceeds(save('pub1', { title: 'Ny' }, 'both'));
  });
});

describe('events: huvudbild (image)', () => {
  const TOKEN = '0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9';
  const bankUrl = (imageId: string, variant: string, ext = 'jpg', bucket = 'okeken.firebasestorage.app') =>
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/image_bank%2F${imageId}-${variant}.${ext}?alt=media&token=${TOKEN}`;
  const image = (over: Record<string, unknown> = {}, imageId = 'Img123abc') => ({
    imageId,
    url: bankUrl(imageId, 'web'),
    thumbnailUrl: bankUrl(imageId, 'thumbnail'),
    alt: 'Löpare vid kontroll 31',
    ...over,
  });
  // pub1 har redan adressen 'tisdagstraning' (låst)
  const publish = (id: string, c: Record<string, unknown>, uid = 'publisher') =>
    save(id, { ...c, status: 'published', slug: id === 'pub1' ? 'tisdagstraning' : `med-bild-${id}`, published: c, publishedAt: serverTimestamp() }, uid);

  it('publicerare kan sätta, publicera och ta bort huvudbild', async () => {
    await assertSucceeds(save('draft1', { image: image() }));
    await assertSucceeds(save('draft1', { image: image({ alt: '' }) }));
    await assertSucceeds(save('draft1', { image: image({}, 'a'.repeat(64)) }));
    await assertSucceeds(save('draft1', { image: image({ url: bankUrl('Img123abc', 'web', 'webp') }) }));
    await assertSucceeds(save('draft1', { image: null }));
    const c = { ...content(), image: image() };
    await assertSucceeds(publish('draft2', c));
    await assertSucceeds(publish('pub1', { ...content(), image: null }));
  });
  it('nytt event med bild får skapas', async () => {
    await assertSucceeds(setDoc(ev(as('publisher'), 'nytt'), newEvent('publisher', { image: image() })));
    await assertFails(setDoc(ev(as('publisher'), 'nytt2'), newEvent('publisher', { image: image({ url: 'https://evil.example/x.jpg' }) })));
  });
  it('event utan image-fält (äldre) kan sparas och publiceras', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { image: _omit, ...legacy } = draftDoc() as Record<string, unknown>;
      await setDoc(doc(ctx.firestore(), 'events', 'legacy'), legacy);
    });
    await assertSucceeds(save('legacy', { title: 'Ny titel' }));
    await assertSucceeds(publish('legacy', { ...content(), title: 'Ny titel' }));
  });
  it('publicerad bild måste vara samma som utkastets', async () => {
    const c = { ...content(), image: image() };
    await assertFails(
      save('draft2', { ...c, status: 'published', slug: 'x', published: { ...c, image: null }, publishedAt: serverTimestamp() }),
    );
    await assertFails(
      save('draft2', { ...c, status: 'published', slug: 'x', published: { ...c, image: image({ alt: 'Annan' }) }, publishedAt: serverTimestamp() }),
    );
    // Snapshot utan image-nyckel nekas (klienten skriver alltid image, null om bild saknas)
    const { image: _omit, ...noImage } = content() as Record<string, unknown>;
    await assertFails(
      save('draft1', { status: 'published', slug: 'x', published: noImage, publishedAt: serverTimestamp() }),
    );
  });
  it('ogiltiga bilder nekas', async () => {
    const bad: Record<string, unknown>[] = [
      { url: 'https://evil.example/x.jpg' },
      { url: 'http://firebasestorage.googleapis.com/v0/b/okeken.firebasestorage.app/o/image_bank%2FImg123abc-web.jpg?alt=media&token=' + TOKEN },
      { url: bankUrl('Img123abc', 'web', 'jpg', 'annan.firebasestorage.app') },
      { url: bankUrl('Img123abc', 'web', 'jpg', 'okeken.appspot.com') },
      { url: bankUrl('Img123abc', 'original') },
      { url: bankUrl('Img123abc', 'web', 'svg') },
      { url: bankUrl('Img123abc', 'web') + '&x=1' },
      { url: 'http://127.0.0.1:9199/v0/b/okeken.firebasestorage.app/o/image_bank%2FImg123abc-web.jpg?alt=media&token=' + TOKEN },
      { url: 'https://firebasestorage.googleapis.com/v0/b/okeken.firebasestorage.app/o/courses%2Fdraft1%2Fa.pdf?alt=media' },
      { thumbnailUrl: bankUrl('Img123abc', 'web') },
      { thumbnailUrl: 'https://evil.example/pixel.gif' },
      { imageId: 'bad/id' },
      { imageId: '' },
      { imageId: 'a'.repeat(65) },
      { alt: 'x'.repeat(301) },
      { alt: 5 },
      { alt: null },
      { url: 7 },
      { extra: 'x' },
    ];
    for (const over of bad) await assertFails(save('draft1', { image: image(over) }));
    await assertFails(save('draft1', { image: 'https://evil.example/x.jpg' }));
    await assertFails(save('draft1', { image: [] }));
    await assertFails(save('draft1', { image: {} }));
    const { alt: _a, ...noAlt } = image();
    await assertFails(save('draft1', { image: noAlt }));
    const { thumbnailUrl: _t, ...noThumb } = image();
    await assertFails(save('draft1', { image: noThumb }));
  });
  it('alt-text: gränsvärden', async () => {
    await assertSucceeds(save('draft1', { image: image({ alt: 'å'.repeat(300) }) }));
    await assertSucceeds(save('draft1', { image: image({ alt: 'rad\nbrytning' }) }));
    await assertFails(save('draft1', { image: image({ alt: 'å'.repeat(301) }) }));
  });
  // Bevakar taket på 1000 uttryck per anrop: värsta fallet (alla fält maxade, 8 banor, bild). Mätt 2026-10-21:
  // ca 4 extra bildkontroller ryms innan taket nås, alltså liten marginal för nya fält i eventet.
  it('publicera bild + 8 banor med maxlängder ryms under uttryckstaket', async () => {
    const big = Array.from({ length: 8 }, (_, i) => ({
      name: 'x'.repeat(200),
      label: 'y'.repeat(200),
      storagePath: `courses/draft2/${i}${'a'.repeat(195)}.pdf`,
    }));
    const c = {
      ...content(),
      title: 't'.repeat(200),
      body: 'b'.repeat(20000),
      location: { name: 'n'.repeat(200), mapUrl: 'https://m.example/' + 'm'.repeat(480) },
      courseSetter: 's'.repeat(200),
      livelox: 'https://l.example/' + 'l'.repeat(480),
      courseFiles: big,
      image: image({ alt: 'a'.repeat(300) }, 'Z'.repeat(64)),
    };
    await assertSucceeds(
      save('draft2', { ...c, status: 'published', slug: 'x'.repeat(120), published: c, publishedAt: serverTimestamp() }),
    );
    // Samma event publicerat igen (published ändras, alla jämförelser körs på nytt)
    await assertSucceeds(
      save('draft2', { ...c, title: 'u'.repeat(200), published: { ...c, title: 'u'.repeat(200) }, publishedAt: serverTimestamp() }),
    );
  });
  it('banläggare får inte ändra bilden, varken i utkastet eller i published', async () => {
    const f = [{ name: 'A.pdf', storagePath: 'courses/pub1/f0-A.pdf', label: 'A' }];
    await assertFails(save('pub1', { image: image() }, 'setter'));
    await assertFails(save('draft1', { image: image() }, 'setter'));
    await assertFails(save('pub1', { courseFiles: f, image: image() }, 'setter'));
    await assertFails(save('pub1', { courseFiles: f, published: { ...content(), courseFiles: f, image: image() } }, 'setter'));
    await assertFails(save('pub1', { image: deleteField() }, 'setter'));
    // Banor på ett event som har bild går fortfarande bra (bilden orörd)
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'events', 'pubImg'), {
        ...publishedDoc(), image: image(), published: { ...content(), image: image() },
      });
    });
    const g = [{ name: 'A.pdf', storagePath: 'courses/pubImg/f0-A.pdf', label: 'A' }];
    await assertSucceeds(save('pubImg', { courseFiles: g, published: { ...content(), image: image(), courseFiles: g } }, 'setter'));
    await assertFails(save('pubImg', { courseFiles: g, published: { ...content(), image: null, courseFiles: g } }, 'setter'));
  });
  it('övriga roller kan inte sätta bild', async () => {
    for (const uid of ['member', 'nobody']) await assertFails(save('draft1', { image: image() }, uid));
  });
});

describe('events: publicerat av (publisher)', () => {
  it('publicerare kan välja, byta och ta bort publicerare', async () => {
    await assertSucceeds(save('draft1', { publisher: 'abc123XYZ' }));
    await assertSucceeds(save('draft1', { publisher: 'annanUid9' }));
    await assertSucceeds(save('draft1', { publisher: null }));
  });
  it('publicerare följer med i ögonblicksbilden vid publicering', async () => {
    const c = { ...content(), publisher: 'abc123XYZ' };
    await assertSucceeds(save('draft2', { ...c, status: 'published', slug: 'med-publicerare', published: c, publishedAt: serverTimestamp() }));
    // Ögonblicksbilden som saknar publicerare men utkastet har en nekas
    const d = { ...content(), publisher: 'abc123XYZ' };
    await assertFails(save('draft1', { ...d, status: 'published', slug: 'utan-snapshot', published: content(), publishedAt: serverTimestamp() }));
  });
  it('nytt event med publicerare får skapas', async () => {
    await assertSucceeds(setDoc(ev(as('publisher'), 'nytt'), newEvent('publisher', { publisher: 'abc123XYZ' })));
  });
  it('ogiltigt värde nekas', async () => {
    for (const bad of ['', 'a/b', 'a b', 'x'.repeat(129), 42, { uid: 'a' }, ['a']]) {
      await assertFails(save('draft1', { publisher: bad }));
    }
  });
  it('event utan publisher-fält (äldre) kan sparas', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { publisher: _omit, ...legacy } = draftDoc() as Record<string, unknown>;
      await setDoc(doc(ctx.firestore(), 'events', 'legacy2'), legacy);
    });
    await assertSucceeds(save('legacy2', { title: 'Ny titel' }));
  });
  it('banläggare kan inte ändra publicerare', async () => {
    await assertFails(save('draft1', { publisher: 'abc123XYZ' }, 'setter'));
  });
});

describe('events: schemalagd publicering (publishAt)', () => {
  const later = () => Timestamp.fromDate(new Date('2030-01-01T12:00:00Z'));
  it('publicerare kan schemalägga, ändra och avbryta', async () => {
    await assertSucceeds(save('draft1', { publishAt: later() }));
    await assertSucceeds(save('draft1', { publishAt: Timestamp.fromDate(new Date('2031-01-01T12:00:00Z')) }));
    await assertSucceeds(save('draft1', { publishAt: null }));
  });
  it('nytt event kan skapas med schema', async () => {
    await assertSucceeds(setDoc(ev(as('publisher'), 'nytt-schema'), newEvent('publisher', { publishAt: later() })));
  });
  it('fel typ nekas', async () => {
    for (const bad of ['2030-01-01', 42, true, { at: 1 }]) await assertFails(save('draft1', { publishAt: bad }));
  });
  it('banläggare och medlemmar kan inte schemalägga', async () => {
    await assertFails(save('draft1', { publishAt: later() }, 'setter'));
    await assertFails(save('draft1', { publishAt: later() }, 'member'));
  });
  it('schemat ingår inte i ögonblicksbilden: publicera nu med publishAt null går', async () => {
    const c = content();
    await assertSucceeds(save('draft2', { ...c, publishAt: null, status: 'published', slug: 'schema-nu', published: c, publishedAt: serverTimestamp() }));
  });
});


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
import { RESERVED_PAGE_SLUGS } from '../../src/lib/slug';

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
    projectId: 'demo-okeken-pages',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

const OLD = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));

const content = () => ({
  title: 'Om klubben',
  body: '# Om klubben\n\nHej',
  inMenu: true,
  menuOrder: 10,
  menuLabel: '',
});

const draftDoc = () => ({
  ...content(),
  status: 'draft',
  slug: null,
  published: null,
  publishedAt: null,
  createdBy: 'publisher',
  createdAt: OLD,
  updatedBy: 'publisher',
  updatedAt: OLD,
});

const publishedDoc = () => ({
  ...draftDoc(),
  status: 'published',
  slug: 'om-klubben',
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
    await setDoc(doc(db, 'pages', 'draft1'), draftDoc());
    await setDoc(doc(db, 'pages', 'draft2'), draftDoc());
    await setDoc(doc(db, 'pages', 'pub1'), publishedDoc());
    await setDoc(doc(db, 'pages', 'unpub1'), { ...publishedDoc(), status: 'unpublished' });
  });
});

const as = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const ghost = () =>
  env.authenticatedContext('ghost', { email: 'ghost@example.com', email_verified: true }).firestore();

const pg = (db: ReturnType<typeof as>, id: string) => doc(db, 'pages', id);

const newPage = (uid = 'publisher', over: Record<string, unknown> = {}) => ({
  ...content(),
  status: 'draft',
  slug: null,
  published: null,
  publishedAt: null,
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedBy: uid,
  updatedAt: serverTimestamp(),
  ...over,
});

const save = (id: string, over: Record<string, unknown>, uid = 'publisher') =>
  updateDoc(pg(as(uid), id), { updatedBy: uid, updatedAt: serverTimestamp(), ...over });

const publish = (over: Record<string, unknown> = {}, id = 'draft1', uid = 'publisher') =>
  save(id, { status: 'published', slug: 'om-klubben', published: content(), publishedAt: serverTimestamp(), ...over }, uid);

describe('pages: read', () => {
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} kan läsa (get och list)`, async () => {
      await assertSucceeds(getDoc(pg(as(uid), 'draft1')));
      await assertSucceeds(getDocs(collection(as(uid), 'pages')));
    });
  }
  for (const uid of ['member', 'setter', 'nobody']) {
    it(`${uid} kan inte läsa`, async () => {
      await assertFails(getDoc(pg(as(uid), 'pub1')));
      await assertFails(getDocs(collection(as(uid), 'pages')));
    });
  }
  it('användare utan dokument och oinloggad kan inte läsa', async () => {
    for (const db of [ghost(), anon()]) {
      await assertFails(getDoc(pg(db, 'pub1')));
      await assertFails(getDocs(collection(db, 'pages')));
    }
  });
});

describe('pages: create', () => {
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} kan skapa giltigt utkast`, async () => {
      await assertSucceeds(setDoc(pg(as(uid), 'new'), newPage(uid)));
    });
  }
  for (const uid of ['member', 'setter', 'nobody']) {
    it(`${uid} kan inte skapa`, async () => {
      await assertFails(setDoc(pg(as(uid), 'new'), newPage(uid)));
    });
  }
  it('användare utan dokument och oinloggad kan inte skapa', async () => {
    await assertFails(setDoc(pg(ghost(), 'new'), newPage('ghost')));
    await assertFails(setDoc(pg(anon(), 'new'), newPage('publisher')));
  });

  const denied: [string, Record<string, unknown>][] = [
    ['status published', { status: 'published' }],
    ['status unpublished', { status: 'unpublished' }],
    ['slug satt', { slug: 'om-klubben' }],
    ['published satt', { published: content() }],
    ['publishedAt satt', { publishedAt: serverTimestamp() }],
    ['createdBy annan användare', { createdBy: 'board' }],
    ['updatedBy annan användare', { updatedBy: 'board' }],
    ['createdAt inte serverTimestamp', { createdAt: OLD }],
    ['updatedAt inte serverTimestamp', { updatedAt: OLD }],
    ['tom title', { title: '' }],
    ['title över 200 tecken', { title: 'x'.repeat(201) }],
    ['title inte sträng', { title: 5 }],
    ['body över 50000 tecken', { body: 'x'.repeat(50001) }],
    ['body inte sträng', { body: null }],
    ['inMenu inte bool', { inMenu: 'ja' }],
    ['menuOrder negativ', { menuOrder: -1 }],
    ['menuOrder över 999', { menuOrder: 1000 }],
    ['menuOrder decimaltal', { menuOrder: 1.5 }],
    ['menuOrder sträng', { menuOrder: '1' }],
    ['menuLabel över 40 tecken', { menuLabel: 'x'.repeat(41) }],
    ['menuLabel null', { menuLabel: null }],
    ['source (finns inte för sidor)', { source: 'manual' }],
    ['okänt fält', { extra: 1 }],
  ];
  for (const [name, over] of denied) {
    it(`nekas: ${name}`, async () => {
      await assertFails(setDoc(pg(as('publisher'), 'new'), newPage('publisher', over)));
    });
  }

  it('gränsvärden accepteras', async () => {
    await assertSucceeds(
      setDoc(
        pg(as('publisher'), 'edge'),
        newPage('publisher', {
          title: 'x'.repeat(200),
          body: 'x'.repeat(50000),
          menuOrder: 999,
          menuLabel: 'x'.repeat(40),
          inMenu: false,
        }),
      ),
    );
    await assertSucceeds(setDoc(pg(as('publisher'), 'edge0'), newPage('publisher', { menuOrder: 0, body: '' })));
  });

  it('saknad nyckel nekas', async () => {
    for (const key of Object.keys(newPage())) {
      const data: Record<string, unknown> = newPage();
      delete data[key];
      await assertFails(setDoc(pg(as('publisher'), `m-${key}`), data));
    }
  });
});

describe('pages: update - utkast', () => {
  it('spara utkastfält tillåts', async () => {
    await assertSucceeds(save('draft1', { title: 'Bli medlem', body: 'Text', menuOrder: 20, inMenu: false }));
  });
  it('board och superadmin kan uppdatera', async () => {
    await assertSucceeds(save('draft1', { title: 'B' }, 'board'));
    await assertSucceeds(save('draft1', { title: 'S' }, 'super'));
  });
  it('member, setter och nobody kan inte uppdatera', async () => {
    for (const uid of ['member', 'setter', 'nobody']) {
      await assertFails(save('draft1', { title: 'X' }, uid));
    }
  });
  it('oinloggad kan inte uppdatera', async () => {
    await assertFails(updateDoc(pg(anon(), 'draft1'), { title: 'X', updatedBy: 'publisher', updatedAt: serverTimestamp() }));
  });
  it('annan updatedBy eller gammal updatedAt nekas', async () => {
    await assertFails(save('draft1', { updatedBy: 'board' }));
    await assertFails(save('draft1', { updatedAt: OLD }));
  });
  it('ändra createdBy / createdAt nekas', async () => {
    await assertFails(save('draft1', { createdBy: 'board' }));
    await assertFails(save('draft1', { createdAt: serverTimestamp() }));
  });
  it('ogiltigt innehåll nekas', async () => {
    await assertFails(save('draft1', { title: '' }));
    await assertFails(save('draft1', { menuOrder: 1000 }));
    await assertFails(save('draft1', { menuOrder: -5 }));
    await assertFails(save('draft1', { menuOrder: 2.5 }));
    await assertFails(save('draft1', { menuLabel: 'x'.repeat(41) }));
  });
  it('okänt fält nekas', async () => {
    await assertFails(save('draft1', { extra: 1 }));
    await assertFails(save('draft1', { source: 'manual' }));
  });
  it('draft med slug eller published nekas', async () => {
    await assertFails(save('draft1', { slug: 'abc' }));
    await assertFails(save('draft1', { published: content(), publishedAt: serverTimestamp() }));
  });
  it('okänd status nekas', async () => {
    await assertFails(save('draft1', { status: 'archived' }));
  });
});

describe('pages: update - publicering', () => {
  it('publicera tillåts', async () => {
    await assertSucceeds(publish());
  });
  it('publicera med ändrade utkastfält tillåts om snapshot matchar', async () => {
    await assertSucceeds(publish({ menuLabel: 'Om oss', published: { ...content(), menuLabel: 'Om oss' } }));
  });
  it('board och superadmin kan publicera', async () => {
    await assertSucceeds(publish({}, 'draft1', 'board'));
    await assertSucceeds(publish({ slug: 'annan' }, 'draft2', 'super'));
  });
  it('member och setter kan inte publicera', async () => {
    await assertFails(publish({}, 'draft1', 'member'));
    await assertFails(publish({}, 'draft1', 'setter'));
  });
  it('snapshot som skiljer sig från utkastet nekas', async () => {
    await assertFails(publish({ published: { ...content(), title: 'Annan' } }));
    await assertFails(publish({ published: { ...content(), body: 'Annan' } }));
    await assertFails(publish({ published: { ...content(), inMenu: false } }));
    await assertFails(publish({ published: { ...content(), menuOrder: 11 } }));
    await assertFails(publish({ published: { ...content(), menuLabel: 'Smyg' } }));
  });
  it('snapshot med extra eller saknade fält nekas', async () => {
    await assertFails(publish({ published: { ...content(), extra: 1 } }));
    const { menuLabel: _m, ...partial } = content();
    await assertFails(publish({ published: partial }));
  });
  it('publishedAt som inte är serverTimestamp nekas', async () => {
    await assertFails(publish({ publishedAt: OLD }));
  });
  for (const slug of ['Om', 'med mellanslag', 'dubbel--bindestreck', '-ledande', 'avslutande-', '', 'a/b', 'x'.repeat(121)]) {
    it(`ogiltig slug nekas: "${slug.slice(0, 20)}"`, async () => {
      await assertFails(publish({ slug }));
    });
  }
  it('slug null vid publicering nekas', async () => {
    await assertFails(publish({ slug: null }));
  });
  for (const slug of RESERVED_PAGE_SLUGS) {
    it(`reserverad slug nekas: ${slug}`, async () => {
      await assertFails(publish({ slug }));
    });
  }
  it('slugs som bara liknar reserverade tillåts', async () => {
    await assertSucceeds(publish({ slug: 'admin-info' }));
    await assertSucceeds(publish({ slug: 'eventor' }, 'draft2'));
  });
  it('status published utan published-map nekas', async () => {
    await assertFails(save('draft1', { status: 'published', slug: 'abc' }));
    await assertFails(save('draft1', { status: 'published', slug: 'abc', published: null }));
  });
});

describe('pages: update - efter publicering', () => {
  it('redigera utkast och behålla gammal published tillåts', async () => {
    await assertSucceeds(save('pub1', { title: 'Ändrad', body: 'Ändrad text', menuOrder: 3 }));
  });
  it('ändra slug efter publicering nekas', async () => {
    await assertFails(save('pub1', { slug: 'ny-adress' }));
    await assertFails(save('unpub1', { slug: 'ny-adress' }));
    await assertFails(save('pub1', { slug: null }));
    await assertFails(save('pub1', { slug: 'admin' }));
  });
  it('publicera om med ny snapshot tillåts', async () => {
    const next = { ...content(), title: 'Ny titel' };
    await assertSucceeds(save('pub1', { title: 'Ny titel', published: next, publishedAt: serverTimestamp() }));
  });
  it('publicera om med snapshot som inte matchar nekas', async () => {
    await assertFails(save('pub1', { title: 'Ny titel', published: content(), publishedAt: serverTimestamp() }));
  });
  it('publicera om med ny slug nekas', async () => {
    await assertFails(save('pub1', { slug: 'annan', published: content(), publishedAt: serverTimestamp() }));
  });
  it('ändra published utan publishedAt nekas', async () => {
    await assertFails(save('pub1', { published: { ...content(), title: 'Smyg' } }));
  });
  it('publishedAt utan serverTimestamp nekas', async () => {
    await assertFails(save('pub1', { publishedAt: Timestamp.fromDate(new Date('2026-02-01T00:00:00Z')) }));
  });
  it('avpublicera och återpublicera tillåts', async () => {
    await assertSucceeds(save('pub1', { status: 'unpublished' }));
    await assertSucceeds(save('unpub1', { status: 'published' }));
  });
  it('tillbaka till draft nekas', async () => {
    await assertFails(save('pub1', { status: 'draft' }));
    await assertFails(save('pub1', { status: 'draft', slug: null, published: null }));
  });
  it('befintlig sida med adress som senare reserverats kan fortfarande redigeras', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pages', 'legacy'), { ...publishedDoc(), slug: 'kalender' });
    });
    await assertSucceeds(save('legacy', { title: 'Ny' }));
    await assertSucceeds(save('legacy', { status: 'unpublished' }));
  });
  it('member och setter kan inte avpublicera', async () => {
    await assertFails(save('pub1', { status: 'unpublished' }, 'member'));
    await assertFails(save('pub1', { status: 'unpublished' }, 'setter'));
  });
});

describe('pages: delete', () => {
  it('publisher/board/super kan radera aldrig publicerat utkast', async () => {
    for (const uid of ['publisher', 'board', 'super']) {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'pages', `d-${uid}`), draftDoc());
      });
      await assertSucceeds(deleteDoc(pg(as(uid), `d-${uid}`)));
    }
  });
  it('publicerad eller avpublicerad sida kan inte raderas', async () => {
    await assertFails(deleteDoc(pg(as('publisher'), 'pub1')));
    await assertFails(deleteDoc(pg(as('super'), 'pub1')));
    await assertFails(deleteDoc(pg(as('publisher'), 'unpub1')));
  });
  it('övriga kan inte radera utkast', async () => {
    for (const db of [as('member'), as('setter'), as('nobody'), ghost(), anon()]) {
      await assertFails(deleteDoc(pg(db, 'draft1')));
    }
  });
});

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

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
    projectId: 'demo-okeken-menu',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

const OLD = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));

type Item = { label: string; pageId: string | null; children: string[] };

const items = (): Item[] => [
  { label: 'Om oss', pageId: 'om-klubben', children: ['bli-medlem'] },
  { label: 'Träning', pageId: null, children: ['traning', 'tavla'] },
];

/** 8 poster med 8 barn var och maxlängd på label och pageId: det dyraste giltiga utkastet */
const fullMenu = (): Item[] =>
  Array.from({ length: 8 }, (_, i) => ({
    label: 'x'.repeat(40),
    pageId: `${i}`.padEnd(128, 'p'),
    children: Array.from({ length: 8 }, (_, j) => `${i}-${j}`.padEnd(128, 'c')),
  }));

const existing = () => ({
  items: items(),
  published: { items: items() },
  publishedAt: OLD,
  updatedBy: 'publisher',
  updatedAt: OLD,
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
  });
});

const seedMenu = (data: Record<string, unknown> = existing()) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'menu', 'main'), data);
  });

const as = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const ghost = () =>
  env.authenticatedContext('ghost', { email: 'ghost@example.com', email_verified: true }).firestore();

const menu = (db: ReturnType<typeof as>, id = 'main') => doc(db, 'menu', id);

const newMenu = (uid = 'publisher', over: Record<string, unknown> = {}) => ({
  items: items(),
  published: null,
  publishedAt: null,
  updatedBy: uid,
  updatedAt: serverTimestamp(),
  ...over,
});

/** Spara utkast: bara items (+ updatedBy/updatedAt) */
const save = (list: unknown, uid = 'publisher', over: Record<string, unknown> = {}) =>
  updateDoc(menu(as(uid)), { items: list, updatedBy: uid, updatedAt: serverTimestamp(), ...over });

/** Publicera: utkast och ögonblicksbild i samma skrivning */
const publish = (list: unknown, uid = 'publisher', over: Record<string, unknown> = {}) =>
  save(list, uid, { published: { items: list }, publishedAt: serverTimestamp(), ...over });

describe('menu: read', () => {
  beforeEach(() => seedMenu());
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} kan läsa`, async () => {
      await assertSucceeds(getDoc(menu(as(uid))));
    });
  }
  for (const uid of ['member', 'setter', 'nobody']) {
    it(`${uid} kan inte läsa`, async () => {
      await assertFails(getDoc(menu(as(uid))));
    });
  }
  it('användare utan dokument och oinloggad kan inte läsa', async () => {
    await assertFails(getDoc(menu(ghost())));
    await assertFails(getDoc(menu(anon())));
  });
});

describe('menu: create', () => {
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} kan skapa utkast`, async () => {
      await assertSucceeds(setDoc(menu(as(uid)), newMenu(uid)));
    });
  }
  it('skapa och publicera i samma skrivning tillåts', async () => {
    await assertSucceeds(
      setDoc(menu(as('publisher')), newMenu('publisher', { published: { items: items() }, publishedAt: serverTimestamp() })),
    );
  });
  it('tom meny tillåts', async () => {
    await assertSucceeds(setDoc(menu(as('publisher')), newMenu('publisher', { items: [] })));
  });
  for (const uid of ['member', 'setter', 'nobody']) {
    it(`${uid} kan inte skapa`, async () => {
      await assertFails(setDoc(menu(as(uid)), newMenu(uid)));
    });
  }
  it('användare utan dokument och oinloggad kan inte skapa', async () => {
    await assertFails(setDoc(menu(ghost()), newMenu('ghost')));
    await assertFails(setDoc(menu(anon()), newMenu('publisher')));
  });
  it('andra dokument än menu/main nekas', async () => {
    await assertFails(setDoc(menu(as('publisher'), 'other'), newMenu()));
    await assertFails(getDoc(menu(as('publisher'), 'other')));
  });

  const denied: [string, Record<string, unknown>][] = [
    ['published som inte matchar utkastet', { published: { items: [] }, publishedAt: serverTimestamp() }],
    ['published utan publishedAt', { published: { items: items() } }],
    ['publishedAt utan published', { publishedAt: serverTimestamp() }],
    ['publishedAt inte serverTimestamp', { published: { items: items() }, publishedAt: OLD }],
    ['updatedBy annan användare', { updatedBy: 'board' }],
    ['updatedAt inte serverTimestamp', { updatedAt: OLD }],
    ['okänt fält', { extra: 1 }],
    ['items inte lista', { items: { 0: items()[0] } }],
  ];
  for (const [name, over] of denied) {
    it(`nekas: ${name}`, async () => {
      await assertFails(setDoc(menu(as('publisher')), newMenu('publisher', over)));
    });
  }
  it('saknad nyckel nekas', async () => {
    for (const key of Object.keys(newMenu())) {
      const data: Record<string, unknown> = newMenu();
      delete data[key];
      await assertFails(setDoc(menu(as('publisher')), data));
    }
  });
});

describe('menu: innehåll', () => {
  beforeEach(() => seedMenu());

  it('full meny (8 poster × 8 barn, maxlängder) tillåts, även publicerad', async () => {
    await assertSucceeds(save(fullMenu()));
    await assertSucceeds(publish(fullMenu()));
  });
  it('full meny kan skapas som publicerad (dyraste skrivningen)', async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'publisher'), { displayName: 'p', email: 'p@example.com', permissions: ['publisher'], createdAt: OLD });
    });
    await assertSucceeds(
      setDoc(menu(as('publisher')), newMenu('publisher', { items: fullMenu(), published: { items: fullMenu() }, publishedAt: serverTimestamp() })),
    );
  });
  it('rubrik utan egen sida och post utan barn tillåts', async () => {
    await assertSucceeds(save([{ label: 'Rubrik', pageId: null, children: [] }, { label: 'Sida', pageId: 'a', children: [] }]));
  });
  it('label med 1 och 40 tecken tillåts', async () => {
    await assertSucceeds(save([{ label: 'x', pageId: 'a', children: [] }, { label: 'å'.repeat(40), pageId: 'b', children: [] }]));
  });

  const bad: [string, unknown][] = [
    ['fler än 8 poster', Array.from({ length: 9 }, (_, i) => ({ label: `P${i}`, pageId: `p${i}`, children: [] }))],
    ['fler än 8 barn', [{ label: 'R', pageId: null, children: Array.from({ length: 9 }, (_, i) => `c${i}`) }]],
    ['tredje nivå (post som barn)', [{ label: 'R', pageId: null, children: [{ label: 'A', pageId: 'a', children: ['b'] }] }]],
    ['barn som map (gammalt förslag { pageId })', [{ label: 'R', pageId: null, children: [{ pageId: 'a' }] }]],
    ['barn inte sträng', [{ label: 'R', pageId: null, children: [5] }]],
    ['barn bool', [{ label: 'R', pageId: null, children: [true] }]],
    ['barn med kommatecken', [{ label: 'R', pageId: null, children: ['a,b'] }]],
    ['barn med radbrytning', [{ label: 'R', pageId: null, children: ['a\nb'] }]],
    ['pageId med kommatecken', [{ label: 'R', pageId: 'a,b', children: [] }]],
    ['okänt fält på post', [{ label: 'R', pageId: 'a', children: [], href: 'https://evil.example' }]],
    ['label saknas', [{ pageId: 'a', children: [] }]],
    ['pageId saknas', [{ label: 'R', children: [] }]],
    ['children saknas', [{ label: 'R', pageId: 'a' }]],
    ['tomt barn', [{ label: 'R', pageId: null, children: [''] }]],
    ['tom label', [{ label: '', pageId: 'a', children: [] }]],
    ['label över 40 tecken', [{ label: 'x'.repeat(41), pageId: 'a', children: [] }]],
    ['label inte sträng', [{ label: 5, pageId: 'a', children: [] }]],
    ['pageId tom', [{ label: 'R', pageId: '', children: [] }]],
    ['pageId med snedstreck', [{ label: 'R', pageId: 'a/b', children: [] }]],
    ['pageId över 128 tecken', [{ label: 'R', pageId: 'x'.repeat(129), children: [] }]],
    ['pageId inte sträng', [{ label: 'R', pageId: 5, children: [] }]],
    ['pageId bool', [{ label: 'R', pageId: true, children: [] }]],
    ['barn med 129 tecken', [{ label: 'R', pageId: null, children: ['x'.repeat(129)] }]],
    ['barn null', [{ label: 'R', pageId: null, children: [null] }]],
    ['barn med snedstreck', [{ label: 'R', pageId: null, children: ['a/b'] }]],
    ['children inte lista', [{ label: 'R', pageId: null, children: 'a' }]],
    ['post inte map', ['Om oss']],
    ['samma sida två gånger som poster', [{ label: 'A', pageId: 'a', children: [] }, { label: 'B', pageId: 'a', children: [] }]],
    ['samma sida som post och eget barn', [{ label: 'A', pageId: 'a', children: ['a'] }]],
    ['samma sida två gånger i samma post', [{ label: 'A', pageId: null, children: ['a', 'a'] }]],
    ['samma sida som barn i två poster', [
      { label: 'A', pageId: null, children: ['x'] },
      { label: 'B', pageId: null, children: ['x'] },
    ]],
    ['samma sida som post och barn i annan post', [
      { label: 'A', pageId: 'x', children: [] },
      { label: 'B', pageId: null, children: ['y', 'x'] },
    ]],
    ['samma sida på sista platserna i full meny', (() => {
      const m = fullMenu();
      m[7].children[7] = m[0].children[0];
      return m;
    })()],
  ];
  for (const [name, list] of bad) {
    it(`nekas: ${name}`, async () => {
      await assertFails(save(list));
      await assertFails(publish(list));
    });
  }
  it('samma rubriktext två gånger tillåts (bara sidorna ska vara unika)', async () => {
    await assertSucceeds(save([{ label: 'A', pageId: null, children: [] }, { label: 'A', pageId: null, children: [] }]));
  });
});

describe('menu: update', () => {
  beforeEach(() => seedMenu());

  it('spara utkast och behålla gammal published tillåts', async () => {
    await assertSucceeds(save([{ label: 'Ny', pageId: 'ny', children: [] }]));
  });
  it('board och superadmin kan spara och publicera', async () => {
    await assertSucceeds(save([], 'board'));
    await assertSucceeds(publish(items(), 'super'));
  });
  it('member, setter och nobody kan inte spara eller publicera', async () => {
    for (const uid of ['member', 'setter', 'nobody']) {
      await assertFails(save([], uid));
      await assertFails(publish(items(), uid));
    }
  });
  it('oinloggad och användare utan dokument kan inte skriva', async () => {
    await assertFails(updateDoc(menu(anon()), { items: [], updatedBy: 'publisher', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(menu(ghost()), { items: [], updatedBy: 'ghost', updatedAt: serverTimestamp() }));
  });
  it('publicera tom meny tillåts', async () => {
    await assertSucceeds(publish([]));
  });
  it('annan updatedBy eller gammal updatedAt nekas', async () => {
    await assertFails(save([], 'publisher', { updatedBy: 'board' }));
    await assertFails(save([], 'publisher', { updatedAt: OLD }));
  });
  it('okänt fält nekas', async () => {
    await assertFails(save(items(), 'publisher', { extra: 1 }));
    await assertFails(save(items(), 'publisher', { status: 'published' }));
  });
  it('snapshot som skiljer sig från utkastet nekas', async () => {
    const other = [{ label: 'Smyg', pageId: 'om-klubben', children: [] }];
    await assertFails(save(items(), 'publisher', { published: { items: other }, publishedAt: serverTimestamp() }));
    // Bara published ändras (utkastet orört) men inte till utkastet
    await assertFails(updateDoc(menu(as('publisher')), { published: { items: other }, publishedAt: serverTimestamp(), updatedBy: 'publisher', updatedAt: serverTimestamp() }));
  });
  it('snapshot med extra fält eller i fel form nekas', async () => {
    await assertFails(save(items(), 'publisher', { published: { items: items(), extra: 1 }, publishedAt: serverTimestamp() }));
    await assertFails(save(items(), 'publisher', { published: items(), publishedAt: serverTimestamp() }));
  });
  it('avpublicera genom att sätta published till null nekas', async () => {
    await assertFails(save(items(), 'publisher', { published: null, publishedAt: serverTimestamp() }));
    await assertFails(save(items(), 'publisher', { published: null, publishedAt: null }));
  });
  it('ändra published utan ny publishedAt nekas', async () => {
    await assertFails(save([], 'publisher', { published: { items: [] } }));
  });
  it('publishedAt som inte är serverTimestamp nekas', async () => {
    await assertFails(publish([], 'publisher', { publishedAt: OLD }));
  });
  it('items får inte tas bort', async () => {
    await assertFails(
      setDoc(menu(as('publisher')), { published: { items: items() }, publishedAt: OLD, updatedBy: 'publisher', updatedAt: serverTimestamp() }),
    );
  });
});

describe('menu: delete', () => {
  beforeEach(() => seedMenu());
  it('ingen kan radera menyn', async () => {
    for (const db of [as('super'), as('board'), as('publisher'), as('setter'), as('member'), anon()]) {
      await assertFails(deleteDoc(menu(db)));
    }
  });
});

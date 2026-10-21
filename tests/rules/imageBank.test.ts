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
    projectId: 'demo-okeken-imagebank',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

const OLD = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
const TOKEN = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const BASE = 'https://firebasestorage.googleapis.com/v0/b/okeken.firebasestorage.app/o/';
const MB = 1024 * 1024;

const path = (id: string, variant: string, ext = 'webp') => `image_bank/${id}-${variant}.${ext}`;
const urlFor = (p: string) => `${BASE}${p.replace('/', '%2F')}?alt=media&token=${TOKEN}`;

/** Giltig post för id (filerna ligger under image_bank/<id>-…) */
const item = (id: string, uid = 'publisher', over: Record<string, unknown> = {}) => ({
  name: 'Tisdagsträning.jpg',
  url: urlFor(path(id, 'original', 'jpg')),
  webUrl: urlFor(path(id, 'web')),
  thumbnailUrl: urlFor(path(id, 'thumbnail')),
  byline: 'Foto: Anna',
  description: 'Löpare vid kontroll i skogen',
  storagePaths: {
    original: path(id, 'original', 'jpg'),
    web: path(id, 'web'),
    thumbnail: path(id, 'thumbnail'),
  },
  size: 4 * MB,
  type: 'image/jpeg',
  uploadedBy: uid,
  createdAt: serverTimestamp(),
  ...over,
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
    await setDoc(doc(db, 'imageBank', 'img1'), { ...item('img1'), createdAt: OLD });
    await setDoc(doc(db, 'imageBank', 'img2'), { ...item('img2', 'board'), createdAt: OLD });
  });
});

const as = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const ghost = () =>
  env.authenticatedContext('ghost', { email: 'ghost@example.com', email_verified: true }).firestore();

const img = (db: ReturnType<typeof as>, id: string) => doc(db, 'imageBank', id);
const create = (id: string, over: Record<string, unknown> = {}, uid = 'publisher') =>
  setDoc(img(as(uid), id), item(id, uid, over));

describe('imageBank: read', () => {
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} kan läsa (get och list)`, async () => {
      await assertSucceeds(getDoc(img(as(uid), 'img1')));
      await assertSucceeds(getDocs(collection(as(uid), 'imageBank')));
    });
  }
  for (const uid of ['member', 'setter', 'nobody']) {
    it(`${uid} kan inte läsa`, async () => {
      await assertFails(getDoc(img(as(uid), 'img1')));
      await assertFails(getDocs(collection(as(uid), 'imageBank')));
    });
  }
  it('användare utan dokument och oinloggad kan inte läsa', async () => {
    for (const db of [ghost(), anon()]) {
      await assertFails(getDoc(img(db, 'img1')));
      await assertFails(getDocs(collection(db, 'imageBank')));
    }
  });
});

describe('imageBank: create', () => {
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} kan skapa giltig post`, async () => {
      await assertSucceeds(create('new1', {}, uid));
    });
  }
  for (const uid of ['member', 'setter', 'nobody']) {
    it(`${uid} kan inte skapa`, async () => {
      await assertFails(create('new1', {}, uid));
    });
  }
  it('användare utan dokument och oinloggad kan inte skapa', async () => {
    await assertFails(setDoc(img(ghost(), 'new1'), item('new1', 'ghost')));
    await assertFails(setDoc(img(anon(), 'new1'), item('new1', 'publisher')));
  });

  it('gränsvärden accepteras', async () => {
    await assertSucceeds(
      create('edge1', {
        name: 'x'.repeat(200),
        byline: 'x'.repeat(200),
        description: 'x'.repeat(300),
        size: 30 * MB,
        type: 'image/png',
      }),
    );
    await assertSucceeds(create('edge2', { name: 'x', byline: '', description: '', size: 0, type: 'image/webp' }));
  });
  it('alla tillåtna ändelser accepteras', async () => {
    const id = 'ext1';
    const paths = { original: path(id, 'original', 'png'), web: path(id, 'web', 'jpg'), thumbnail: path(id, 'thumbnail', 'webp') };
    await assertSucceeds(
      create(id, {
        storagePaths: paths,
        url: urlFor(paths.original),
        webUrl: urlFor(paths.web),
        thumbnailUrl: urlFor(paths.thumbnail),
      }),
    );
  });

  const id = 'new2';
  const paths = item(id).storagePaths;
  const denied: [string, Record<string, unknown>][] = [
    // Externa och felaktiga adresser
    ['extern url', { url: 'https://evil.example.com/pixel.gif' }],
    ['extern webUrl', { webUrl: 'https://evil.example.com/a.webp' }],
    ['extern thumbnailUrl', { thumbnailUrl: 'https://evil.example.com/a.webp' }],
    ['http i stället för https', { webUrl: urlFor(paths.web).replace('https://', 'http://') }],
    ['annan bucket', { webUrl: urlFor(paths.web).replace('okeken.firebasestorage.app', 'evil.appspot.com') }],
    ['annan värd med rätt sökväg', { webUrl: urlFor(paths.web).replace('firebasestorage.googleapis.com', 'evil.com') }],
    ['url-prefix som del av annan värd', { webUrl: 'https://firebasestorage.googleapis.com.evil.com/v0/b/okeken.firebasestorage.app/o/image_bank%2Fnew2-web.webp?alt=media&token=' + TOKEN }],
    ['url pekar på courses/', { webUrl: `${BASE}courses%2Fev1%2Fbana.pdf?alt=media&token=${TOKEN}` }],
    ['url pekar på annan posts fil', { webUrl: urlFor(path('img1', 'web')) }],
    ['url och storagePath olika varianter', { webUrl: urlFor(paths.thumbnail) }],
    ['url med annan ändelse än storagePath', { webUrl: urlFor(path(id, 'web', 'png')) }],
    ['url utan token', { webUrl: `${BASE}image_bank%2F${id}-web.webp?alt=media` }],
    ['url med extra parameter', { webUrl: `${urlFor(paths.web)}&x=1` }],
    ['url med fragment', { webUrl: `${urlFor(paths.web)}#x` }],
    ['url med okodat snedstreck', { webUrl: `${BASE}image_bank/${id}-web.webp?alt=media&token=${TOKEN}` }],
    ['url med ogiltig token', { webUrl: `${BASE}image_bank%2F${id}-web.webp?alt=media&token=abc` }],
    ['url över 1000 tecken', { webUrl: urlFor(paths.web) + 'x'.repeat(1000) }],
    ['url inte sträng', { webUrl: 5 }],
    ['url null', { url: null }],
    // Sökvägar
    ['storagePath under courses/', { storagePaths: { ...paths, web: 'courses/ev1/bana.pdf' } }],
    ['storagePath för annan post', { storagePaths: { ...paths, web: path('img1', 'web') }, webUrl: urlFor(path('img1', 'web')) }],
    ['storagePath med underkatalog', { storagePaths: { ...paths, web: `image_bank/sub/${id}-web.webp` } }],
    ['storagePath med ..', { storagePaths: { ...paths, web: `image_bank/../courses/${id}-web.webp` } }],
    ['storagePath med fel variant', { storagePaths: { ...paths, web: path(id, 'thumbnail') } }],
    ['storagePath svg', { storagePaths: { ...paths, web: path(id, 'web', 'svg') }, webUrl: urlFor(path(id, 'web', 'svg')) }],
    ['storagePath gif', { storagePaths: { ...paths, web: path(id, 'web', 'gif') }, webUrl: urlFor(path(id, 'web', 'gif')) }],
    ['storagePath över 300 tecken', { storagePaths: { ...paths, web: `image_bank/${'x'.repeat(300)}-web.webp` } }],
    ['storagePaths extra nyckel', { storagePaths: { ...paths, fourK: path(id, 'original', 'jpg') } }],
    ['storagePaths saknar nyckel', { storagePaths: { original: paths.original, web: paths.web } }],
    ['storagePaths inte map', { storagePaths: 'image_bank/x' }],
    // Metadata
    ['tomt name', { name: '' }],
    ['name över 200 tecken', { name: 'x'.repeat(201) }],
    ['name inte sträng', { name: 5 }],
    ['byline över 200 tecken', { byline: 'x'.repeat(201) }],
    ['byline null', { byline: null }],
    ['description över 300 tecken', { description: 'x'.repeat(301) }],
    ['description null', { description: null }],
    // Fil
    ['size negativ', { size: -1 }],
    ['size över 30 MB', { size: 30 * MB + 1 }],
    ['size decimaltal', { size: 1.5 }],
    ['size sträng', { size: '100' }],
    ['type gif', { type: 'image/gif' }],
    ['type svg', { type: 'image/svg+xml' }],
    ['type html', { type: 'text/html' }],
    // Skapare och tid
    ['uploadedBy annan användare', { uploadedBy: 'board' }],
    ['createdAt inte serverTimestamp', { createdAt: OLD }],
    // Övrigt
    ['okänt fält', { extra: 1 }],
    ['fourKUrl (finns inte här)', { fourKUrl: urlFor(paths.web) }],
    ['updatedAt (finns inte här)', { updatedAt: serverTimestamp() }],
  ];
  for (const [name, over] of denied) {
    it(`nekas: ${name}`, async () => {
      await assertFails(create(id, over));
    });
  }

  it('saknad nyckel nekas', async () => {
    for (const key of Object.keys(item('x'))) {
      const data: Record<string, unknown> = item(`m${key}`);
      delete data[key];
      await assertFails(setDoc(img(as('publisher'), `m${key}`), data));
    }
  });

  it('dokument-id med specialtecken nekas (id:t används i regexen)', async () => {
    for (const bad of ['a-b', 'a_b', 'a.b', '.*', 'x'.repeat(65)]) {
      await assertFails(setDoc(img(as('publisher'), bad), item(bad)));
    }
  });
  it('id med regextecken kan inte matcha andras filer', async () => {
    // Om id:t inte kontrollerades skulle '.*' i regexen kunna matcha valfri sökväg
    const data = item('img1');
    await assertFails(setDoc(img(as('publisher'), '.*'), data));
  });
  it('befintlig post kan inte skrivas över med create', async () => {
    await assertFails(setDoc(img(as('publisher'), 'img1'), item('img1')));
  });
});

describe('imageBank: update', () => {
  const upd = (id: string, data: Record<string, unknown>, uid = 'publisher') => updateDoc(img(as(uid), id), data);

  it('ändra name, byline och description tillåts', async () => {
    await assertSucceeds(upd('img1', { name: 'Nytt namn', byline: 'Foto: Bo', description: 'Ny alt-text' }));
    await assertSucceeds(upd('img1', { byline: '', description: '' }));
  });
  it('board och superadmin kan ändra, även andras poster', async () => {
    await assertSucceeds(upd('img1', { name: 'B' }, 'board'));
    await assertSucceeds(upd('img2', { name: 'S' }, 'super'));
  });
  it('member, setter och nobody kan inte ändra', async () => {
    for (const uid of ['member', 'setter', 'nobody']) {
      await assertFails(upd('img1', { name: 'X' }, uid));
    }
  });
  it('oinloggad och användare utan dokument kan inte ändra', async () => {
    await assertFails(updateDoc(img(anon(), 'img1'), { name: 'X' }));
    await assertFails(updateDoc(img(ghost(), 'img1'), { name: 'X' }));
  });

  const locked: [string, Record<string, unknown>][] = [
    ['url', { url: urlFor(path('img1', 'web')) }],
    ['url till extern', { url: 'https://evil.example.com/pixel.gif' }],
    ['webUrl', { webUrl: urlFor(path('img1', 'thumbnail')) }],
    ['thumbnailUrl', { thumbnailUrl: urlFor(path('img1', 'web')) }],
    ['storagePaths', { storagePaths: { ...item('img1').storagePaths, web: 'courses/ev1/bana.pdf' } }],
    ['storagePaths.web', { 'storagePaths.web': path('img1', 'thumbnail') }],
    ['size', { size: 1 }],
    ['type', { type: 'image/png' }],
    ['uploadedBy', { uploadedBy: 'publisher2' }],
    ['createdAt', { createdAt: serverTimestamp() }],
    ['extra fält', { extra: 1 }],
    ['updatedAt', { updatedAt: serverTimestamp() }],
  ];
  for (const [name, data] of locked) {
    it(`låst fält nekas: ${name}`, async () => {
      await assertFails(upd('img1', data));
      await assertFails(upd('img1', { ...data, name: 'Samtidigt' }, 'super'));
    });
  }

  it('ogiltig metadata nekas', async () => {
    await assertFails(upd('img1', { name: '' }));
    await assertFails(upd('img1', { name: 'x'.repeat(201) }));
    await assertFails(upd('img1', { byline: 'x'.repeat(201) }));
    await assertFails(upd('img1', { description: 'x'.repeat(301) }));
    await assertFails(upd('img1', { description: null }));
    await assertFails(upd('img1', { name: 5 }));
  });
  it('ta bort metadatafält nekas', async () => {
    await assertFails(upd('img1', { byline: deleteField() }));
    await assertFails(upd('img1', { description: deleteField() }));
  });
});

describe('imageBank: delete', () => {
  it('publisher/board/super kan radera', async () => {
    await assertSucceeds(deleteDoc(img(as('publisher'), 'img1')));
    await assertSucceeds(deleteDoc(img(as('board'), 'img2')));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'imageBank', 'img3'), { ...item('img3'), createdAt: OLD });
    });
    await assertSucceeds(deleteDoc(img(as('super'), 'img3')));
  });
  it('övriga kan inte radera', async () => {
    for (const db of [as('member'), as('setter'), as('nobody'), ghost(), anon()]) {
      await assertFails(deleteDoc(img(db, 'img1')));
    }
  });
});

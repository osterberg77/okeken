import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { getBytes, listAll, ref, uploadBytes } from 'firebase/storage';

// Orienteringskartor (beslut 0025): maps/{mapId} i Firestore, map_sources/ och map_tiles/ i Storage.
let env: RulesTestEnvironment;

const USERS: Record<string, string[]> = {
  publisher: ['publisher'],
  board: ['board'],
  super: ['superadmin'],
  member: ['member'],
  nobody: [],
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Storage-emulatorn slår upp användare och kartor i Firestore under --project (demo-okeken)
    projectId: 'demo-okeken',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

const OLD = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
const TILE = 'map_tiles/botorp/0123456789abcdef01234567/15/17829/9839.png';

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, permissions] of Object.entries(USERS)) {
      await setDoc(doc(ctx.firestore(), 'users', uid), { displayName: uid, email: `${uid}@example.com`, permissions, createdAt: OLD });
    }
    await setDoc(doc(ctx.firestore(), 'maps', 'botorp'), {
      name: 'Botorp',
      createdBy: 'publisher',
      createdAt: OLD,
      updatedBy: 'publisher',
      updatedAt: OLD,
      current: { version: '0123456789abcdef01234567', minZoom: 12, maxZoom: 17 },
      job: { status: 'done' },
    });
    await uploadBytes(ref(ctx.storage(), TILE), new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
  });
});

const fs = (uid: string | null) => (uid ? env.authenticatedContext(uid, { email_verified: true }) : env.unauthenticatedContext()).firestore();
const st = (uid: string | null) => (uid ? env.authenticatedContext(uid, { email_verified: true }) : env.unauthenticatedContext()).storage();

const newMap = (uid: string, extra: Record<string, unknown> = {}) => ({
  name: 'Åtvid',
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedBy: uid,
  updatedAt: serverTimestamp(),
  ...extra,
});

describe('maps – läsa', () => {
  for (const uid of ['member', 'publisher', 'board', 'super']) {
    it(`${uid} får läsa`, () => assertSucceeds(getDoc(doc(fs(uid), 'maps', 'botorp'))));
  }
  it('inloggad utan behörighet får inte läsa', () => assertFails(getDoc(doc(fs('nobody'), 'maps', 'botorp'))));
  it('besökare får inte läsa', () => assertFails(getDoc(doc(fs(null), 'maps', 'botorp'))));
});

describe('maps – skapa och ändra', () => {
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} får skapa`, () => assertSucceeds(setDoc(doc(fs(uid), 'maps', 'atvid'), newMap(uid))));
  }
  it('medlem får inte skapa', () => assertFails(setDoc(doc(fs('member'), 'maps', 'atvid'), newMap('member'))));
  it('ogiltigt id nekas', () => assertFails(setDoc(doc(fs('publisher'), 'maps', 'Åtvid karta'), newMap('publisher'))));
  it('för långt namn nekas', () => assertFails(setDoc(doc(fs('publisher'), 'maps', 'atvid'), newMap('publisher', { name: 'x'.repeat(81) }))));
  it('klienten får inte sätta current', () =>
    assertFails(setDoc(doc(fs('publisher'), 'maps', 'atvid'), newMap('publisher', { current: { version: 'x' } }))));
  it('annan createdBy nekas', () => assertFails(setDoc(doc(fs('publisher'), 'maps', 'atvid'), newMap('publisher', { createdBy: 'board' }))));

  it('publicerare får byta namn', () =>
    assertSucceeds(updateDoc(doc(fs('publisher'), 'maps', 'botorp'), { name: 'Botorp 2026', updatedBy: 'publisher', updatedAt: serverTimestamp() })));
  it('medlem får inte byta namn', () =>
    assertFails(updateDoc(doc(fs('member'), 'maps', 'botorp'), { name: 'X', updatedBy: 'member', updatedAt: serverTimestamp() })));
  it('publicerare får inte ändra current', () =>
    assertFails(updateDoc(doc(fs('publisher'), 'maps', 'botorp'), { 'current.version': 'gissad', updatedBy: 'publisher', updatedAt: serverTimestamp() })));
  it('publicerare får inte ändra job', () =>
    assertFails(updateDoc(doc(fs('publisher'), 'maps', 'botorp'), { 'job.status': 'failed', updatedBy: 'publisher', updatedAt: serverTimestamp() })));
  it('ingen får radera', () => assertFails(deleteDoc(doc(fs('super'), 'maps', 'botorp'))));
});

let n = 0;
const source = (map = 'botorp', ext = 'omap') => `map_sources/${map}/${String(1763300000000 + n++)}-Kartbas_Botorp_25.${ext}`;
const bytes = (size = 100) => new Uint8Array(size).fill(60);

describe('storage: map_sources', () => {
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} får ladda upp .omap`, () => assertSucceeds(uploadBytes(ref(st(uid), source()), bytes())));
  }
  it('.ocd går också', () => assertSucceeds(uploadBytes(ref(st('publisher'), source('botorp', 'ocd')), bytes())));
  it('medlem får inte ladda upp', () => assertFails(uploadBytes(ref(st('member'), source()), bytes())));
  it('besökare får inte ladda upp', () => assertFails(uploadBytes(ref(st(null), source()), bytes())));
  it('karta som saknas i Firestore nekas', () => assertFails(uploadBytes(ref(st('publisher'), source('finns-inte')), bytes())));
  it('annan filtyp nekas', () => assertFails(uploadBytes(ref(st('publisher'), source('botorp', 'pdf')), bytes())));
  it('filnamn utan tidsstämpel nekas', () => assertFails(uploadBytes(ref(st('publisher'), 'map_sources/botorp/karta.omap'), bytes())));
  it('tom fil nekas', () => assertFails(uploadBytes(ref(st('publisher'), source()), bytes(0))));

  it('medlemmar får hämta originalet, inte inloggad utan behörighet eller besökare', async () => {
    const path = source();
    await assertSucceeds(uploadBytes(ref(st('publisher'), path), bytes()));
    await assertSucceeds(getBytes(ref(st('board'), path)));
    await assertSucceeds(getBytes(ref(st('member'), path)));
    await assertFails(getBytes(ref(st('nobody'), path)));
    await assertFails(getBytes(ref(st(null), path)));
  });
  it('ingen får lista', () => assertFails(listAll(ref(st('super'), 'map_sources/botorp'))));
});

describe('storage: map_tiles', () => {
  it('besökare får hämta en tile med adressen', () => assertSucceeds(getBytes(ref(st(null), TILE))));
  it('ingen får lista versionerna', () => assertFails(listAll(ref(st('super'), 'map_tiles/botorp'))));
  it('ingen får skriva tiles', () => assertFails(uploadBytes(ref(st('super'), 'map_tiles/botorp/x/1/1/1.png'), bytes(), { contentType: 'image/png' })));
});

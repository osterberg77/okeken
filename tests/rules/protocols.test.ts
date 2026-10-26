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
  sec: ['board'],
  adj: ['board'],
  board: ['board'],
  super: ['superadmin'],
  publisher: ['publisher'],
  member: ['member'],
  setter: ['member'],
  nobody: [],
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Eget projekt-id så att parallella testfiler inte rensar varandras data
    projectId: 'demo-okeken-protocols',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

const OLD = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
const MEETING = Timestamp.fromDate(new Date('2026-10-20T17:00:00Z'));

/** Närvarande (frånvarande noteras inte) */
const attendees = () => [
  { uid: 'sec', name: 'Sekreteraren' },
  { uid: 'adj', name: 'Justeraren' },
  { uid: 'board', name: 'Ledamot' },
];

const todos = () => [
  { id: 'todo1', text: 'Boka lokal', assigneeUid: 'board', assigneeName: 'Ledamot', done: false },
  { id: 'todo2', text: 'Beställa kartor', assigneeUid: null, assigneeName: '', done: true },
];

const content = () => ({
  meetingAt: MEETING,
  location: 'Klubbstugan',
  body: '# 1 Mötets öppnande\n\n@[Ledamot](mention:board) öppnade mötet.',
  attendees: attendees(),
  todos: todos(),
  secretaryUid: 'sec',
  secretaryName: 'Sekreteraren',
  adjusterUid: 'adj',
  adjusterName: 'Justeraren',
});

/** Ett fullstort giltigt protokoll: alla tak (10 närvarande, 8 att göra) och maxlängder, det dyraste giltiga innehållet */
const fullContent = () => ({
  ...content(),
  location: 'l'.repeat(200),
  body: 'x'.repeat(50000),
  attendees: Array.from({ length: 10 }, (_, i) => ({ uid: `${i}`.padEnd(128, 'u'), name: 'n'.repeat(200) })),
  todos: Array.from({ length: 8 }, (_, i) => ({
    id: `${i}`.padEnd(64, 't'),
    text: 'å'.repeat(300),
    assigneeUid: `${i}`.padEnd(128, 'a'),
    assigneeName: 'n'.repeat(200),
    done: i % 2 === 1,
  })),
  secretaryUid: 'sec',
  secretaryName: 's'.repeat(200),
  adjusterUid: 'adj',
  adjusterName: 'j'.repeat(200),
});

/** Lagrat dokument (seedas utan regler) */
const stored = (over: Record<string, unknown> = {}) => ({
  ...content(),
  secretaryApprovedAt: null,
  adjusterApprovedAt: null,
  createdBy: 'board',
  createdAt: OLD,
  updatedBy: 'board',
  updatedAt: OLD,
  ...over,
});

/** Nytt utkast så som klienten skapar det */
const newProtocol = (uid = 'board', over: Record<string, unknown> = {}) => ({
  ...content(),
  secretaryApprovedAt: null,
  adjusterApprovedAt: null,
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedBy: uid,
  updatedAt: serverTimestamp(),
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
  });
});

const seed = (data: Record<string, unknown> = stored(), id = 'p1') =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'protocols', id), data);
  });

const as = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const ghost = () =>
  env.authenticatedContext('ghost', { email: 'ghost@example.com', email_verified: true }).firestore();

const ref = (db: ReturnType<typeof as>, id = 'p1') => doc(db, 'protocols', id);

/** Innehållsändring så som klienten sparar: innehåll + nollställda godkännanden + updatedBy/updatedAt */
const save = (uid: string, over: Record<string, unknown> = {}, id = 'p1') =>
  updateDoc(ref(as(uid), id), {
    ...content(),
    secretaryApprovedAt: null,
    adjusterApprovedAt: null,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
    ...over,
  });

const approve = (uid: string, field: 'secretaryApprovedAt' | 'adjusterApprovedAt', over: Record<string, unknown> = {}) =>
  updateDoc(ref(as(uid)), { [field]: serverTimestamp(), ...over });

const revoke = (uid: string, field: 'secretaryApprovedAt' | 'adjusterApprovedAt') =>
  updateDoc(ref(as(uid)), { [field]: null });

const lockedDoc = () => stored({ secretaryApprovedAt: OLD, adjusterApprovedAt: OLD });

describe('protocols: read', () => {
  beforeEach(() => seed());
  for (const uid of ['board', 'super', 'sec']) {
    it(`${uid} kan läsa och lista`, async () => {
      await assertSucceeds(getDoc(ref(as(uid))));
      await assertSucceeds(getDocs(collection(as(uid), 'protocols')));
    });
  }
  for (const uid of ['publisher', 'member', 'setter', 'nobody']) {
    it(`${uid} kan inte läsa eller lista`, async () => {
      await assertFails(getDoc(ref(as(uid))));
      await assertFails(getDocs(collection(as(uid), 'protocols')));
    });
  }
  it('oinloggad och användare utan dokument kan inte läsa', async () => {
    await assertFails(getDoc(ref(anon())));
    await assertFails(getDoc(ref(ghost())));
    await assertFails(getDocs(collection(anon(), 'protocols')));
  });
});

describe('protocols: create', () => {
  for (const uid of ['board', 'super']) {
    it(`${uid} kan skapa utkast`, async () => {
      await assertSucceeds(setDoc(ref(as(uid)), newProtocol(uid)));
    });
  }
  it('utkast utan sekreterare, justerare, deltagare och att göra tillåts', async () => {
    await assertSucceeds(
      setDoc(ref(as('board')), newProtocol('board', {
        secretaryUid: null, secretaryName: '', adjusterUid: null, adjusterName: '', attendees: [], todos: [], body: '', location: '',
      })),
    );
  });
  for (const uid of ['publisher', 'member', 'setter', 'nobody']) {
    it(`${uid} kan inte skapa`, async () => {
      await assertFails(setDoc(ref(as(uid)), newProtocol(uid)));
    });
  }
  it('oinloggad och användare utan dokument kan inte skapa', async () => {
    await assertFails(setDoc(ref(anon()), newProtocol('board')));
    await assertFails(setDoc(ref(ghost()), newProtocol('ghost')));
  });

  const denied: [string, Record<string, unknown>][] = [
    ['med sekreterarens godkännande', { secretaryApprovedAt: serverTimestamp() }],
    ['med justerarens godkännande', { adjusterApprovedAt: serverTimestamp() }],
    ['direkt som låst', { secretaryApprovedAt: serverTimestamp(), adjusterApprovedAt: serverTimestamp() }],
    ['med gammalt godkännande', { secretaryApprovedAt: OLD }],
    ['createdBy annan användare', { createdBy: 'sec' }],
    ['updatedBy annan användare', { updatedBy: 'sec' }],
    ['createdAt från klienten', { createdAt: OLD }],
    ['updatedAt från klienten', { updatedAt: OLD }],
    ['okänt fält', { extra: 1 }],
    ['status-fält', { status: 'locked' }],
    ['sekreterare == justerare', { adjusterUid: 'sec' }],
  ];
  for (const [name, over] of denied) {
    it(`nekas: ${name}`, async () => {
      await assertFails(setDoc(ref(as('board')), newProtocol('board', over)));
    });
  }
  it('saknad nyckel nekas', async () => {
    for (const key of Object.keys(newProtocol())) {
      const data: Record<string, unknown> = newProtocol();
      delete data[key];
      await assertFails(setDoc(ref(as('board')), data));
    }
  });
});

describe('protocols: fältvalidering', () => {
  beforeEach(() => seed());

  const bad: [string, Record<string, unknown>][] = [
    ['meetingAt inte timestamp', { meetingAt: '2026-10-20' }],
    ['meetingAt null', { meetingAt: null }],
    ['location över 200 tecken', { location: 'x'.repeat(201) }],
    ['location inte sträng', { location: 5 }],
    ['body över 50 000 tecken', { body: 'x'.repeat(50001) }],
    ['body inte sträng', { body: null }],
    ['secretaryUid fel format', { secretaryUid: 'a/b' }],
    ['secretaryUid tom', { secretaryUid: '' }],
    ['secretaryUid inte sträng', { secretaryUid: 5 }],
    ['adjusterUid över 128 tecken', { adjusterUid: 'x'.repeat(129) }],
    ['secretaryName över 200 tecken', { secretaryName: 'x'.repeat(201) }],
    ['adjusterName inte sträng', { adjusterName: null }],
    ['sekreterare == justerare', { adjusterUid: 'sec' }],
    ['attendees inte lista', { attendees: { 0: attendees()[0] } }],
    ['fler än 10 deltagare', { attendees: Array.from({ length: 11 }, (_, i) => ({ uid: `u${i}`, name: 'N' })) }],
    ['deltagare inte map', { attendees: ['sec'] }],
    // Sträng med samma längd som antalet nycklar: size() == 2 stämmer, men .uid ger fel
    ['deltagare som sträng med längd 2', { attendees: ['ab'] }],
    ['deltagare med okänt fält', { attendees: [{ uid: 'sec', name: 'S', role: 'admin' }] }],
    ['deltagare med gamla present-flaggan', { attendees: [{ uid: 'sec', name: 'S', present: true }] }],
    ['deltagare utan uid', { attendees: [{ name: 'S' }] }],
    ['deltagare utan name', { attendees: [{ uid: 'sec' }] }],
    ['deltagare med okänd nyckel i stället för name', { attendees: [{ uid: 'sec', x: 'S' }] }],
    ['deltagare med tomt namn', { attendees: [{ uid: 'sec', name: '' }] }],
    ['deltagare med för långt namn', { attendees: [{ uid: 'sec', name: 'x'.repeat(201) }] }],
    ['deltagare name inte sträng', { attendees: [{ uid: 'sec', name: 5 }] }],
    ['deltagare uid med kommatecken', { attendees: [{ uid: 'a,b', name: 'S' }] }],
    ['deltagare uid med snedstreck', { attendees: [{ uid: 'a/b', name: 'S' }] }],
    ['deltagare uid inte sträng', { attendees: [{ uid: 5, name: 'S' }] }],
    ['deltagare uid null', { attendees: [{ uid: null, name: 'S' }] }],
    ['ogiltig deltagare på sista platsen', {
      attendees: Array.from({ length: 10 }, (_, i) => ({ uid: i === 9 ? 'a b' : `u${i}`, name: 'N' })),
    }],
    ['todos inte lista', { todos: 'Boka lokal' }],
    ['fler än 8 att göra', { todos: Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, text: 'T', assigneeUid: null, assigneeName: '', done: false })) }],
    ['att göra med okänt fält', { todos: [{ ...todos()[0], dueAt: OLD }] }],
    ['att göra utan id', { todos: [{ text: 'T', assigneeUid: null, assigneeName: '', done: false }] }],
    ['att göra utan done', { todos: [{ id: 't', text: 'T', assigneeUid: null, assigneeName: '' }] }],
    ['att göra utan assigneeUid', { todos: [{ id: 't', text: 'T', assigneeName: '', done: false }] }],
    ['att göra med tom text', { todos: [{ ...todos()[0], text: '' }] }],
    ['att göra med text över 300 tecken', { todos: [{ ...todos()[0], text: 'x'.repeat(301) }] }],
    ['att göra text inte sträng', { todos: [{ ...todos()[0], text: 5 }] }],
    ['att göra done inte bool', { todos: [{ ...todos()[0], done: 1 }] }],
    ['att göra assigneeUid fel format', { todos: [{ ...todos()[0], assigneeUid: 'a b' }] }],
    ['att göra assigneeName för lång', { todos: [{ ...todos()[0], assigneeName: 'x'.repeat(201) }] }],
    ['att göra id med kommatecken', { todos: [{ ...todos()[0], id: 'a,b' }] }],
    ['att göra id över 64 tecken', { todos: [{ ...todos()[0], id: 'x'.repeat(65) }] }],
    ['att göra id inte sträng', { todos: [{ ...todos()[0], id: 7 }] }],
    ['att göra som sträng med längd 5', { todos: ['abcde'] }],
    ['ogiltig att göra-punkt på sista platsen', {
      todos: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, text: i === 7 ? '' : 'T', assigneeUid: null, assigneeName: '', done: false })),
    }],
  ];
  for (const [name, over] of bad) {
    it(`nekas: ${name}`, async () => {
      await assertFails(save('board', over));
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'board'), { displayName: 'b', email: 'b@example.com', permissions: ['board'], createdAt: OLD });
      });
      await assertFails(setDoc(ref(as('board'), 'p2'), newProtocol('board', over)));
    });
  }
  it('gränsvärden tillåts (1 tecken, exakt maxlängd, 300 tecken per punkt)', async () => {
    await assertSucceeds(
      save('board', {
        attendees: [{ uid: 'a', name: 'x' }],
        todos: [{ id: 'x', text: 'x'.repeat(300), assigneeUid: 'x'.repeat(128), assigneeName: 'x'.repeat(200), done: false }],
        location: 'x'.repeat(200),
      }),
    );
  });
});

describe('protocols: fullt protokoll (taket på 1000 uttryck per anrop, se firestore.rules)', () => {
  it('skapa fullt protokoll tillåts', async () => {
    await assertSucceeds(setDoc(ref(as('board')), newProtocol('board', fullContent())));
  });
  it('spara fullt protokoll (från godkänt av ena, nollställer) tillåts', async () => {
    await seed(stored({ ...fullContent(), secretaryApprovedAt: OLD }));
    await assertSucceeds(save('board', fullContent()));
  });
  it('godkänna och dra tillbaka på fullt protokoll tillåts', async () => {
    await seed(stored(fullContent()));
    await assertSucceeds(approve('sec', 'secretaryApprovedAt'));
    await assertSucceeds(revoke('sec', 'secretaryApprovedAt'));
    await assertSucceeds(approve('sec', 'secretaryApprovedAt'));
    await assertSucceeds(approve('adj', 'adjusterApprovedAt'));
  });
  it('fullt protokoll med ogiltig sista post nekas (sista platsen kontrolleras även när taket är nått)', async () => {
    const c = fullContent();
    c.todos[7].text = 'x'.repeat(301);
    await assertFails(setDoc(ref(as('board')), newProtocol('board', c)));
    const d = fullContent();
    d.attendees[9].name = '';
    await assertFails(setDoc(ref(as('board')), newProtocol('board', d)));
  });
  it('innehållsändring av sekreteraren själv på fullt protokoll tillåts (dyraste vägen)', async () => {
    await seed(stored({ ...fullContent(), secretaryApprovedAt: OLD, updatedBy: 'sec' }));
    await assertSucceeds(save('sec', { ...fullContent(), location: 'Ny plats' }));
  });
});

describe('protocols: innehållsändring', () => {
  it('board och superadmin kan spara utkast', async () => {
    await seed();
    await assertSucceeds(save('board', { body: 'Ny text' }));
    await assertSucceeds(save('super', { location: 'Digitalt' }));
  });
  for (const uid of ['publisher', 'member', 'setter', 'nobody']) {
    it(`${uid} kan inte spara`, async () => {
      await seed();
      await assertFails(save(uid, { body: 'Ny text' }));
    });
  }
  it('oinloggad kan inte spara', async () => {
    await seed();
    await assertFails(updateDoc(ref(anon()), { body: 'x', updatedBy: 'board', updatedAt: serverTimestamp() }));
  });
  it('ändring på godkänt av ena som nollställer tillåts', async () => {
    await seed(stored({ secretaryApprovedAt: OLD }));
    await assertSucceeds(save('board', { body: 'Rättad text' }));
  });
  it('ändring utan att nollställa godkännandet nekas', async () => {
    await seed(stored({ secretaryApprovedAt: OLD }));
    await assertFails(updateDoc(ref(as('board')), { body: 'Smygändring', updatedBy: 'board', updatedAt: serverTimestamp() }));
    await assertFails(save('board', { body: 'Smygändring', secretaryApprovedAt: OLD }));
    await seed(stored({ adjusterApprovedAt: OLD }));
    await assertFails(save('board', { body: 'Smygändring', adjusterApprovedAt: OLD }));
  });
  it('ändring som sätter ett godkännande samtidigt nekas', async () => {
    await seed();
    await assertFails(save('sec', { body: 'Ny', secretaryApprovedAt: serverTimestamp() }));
  });
  it('byta sekreterare eller justerare efter godkännande måste nollställa', async () => {
    await seed(stored({ secretaryApprovedAt: OLD }));
    await assertFails(updateDoc(ref(as('board')), { secretaryUid: 'board', updatedBy: 'board', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref(as('board')), { adjusterUid: 'board', updatedBy: 'board', updatedAt: serverTimestamp() }));
    await assertSucceeds(save('board', { secretaryUid: 'board', secretaryName: 'Ledamot' }));
  });
  it('ändra deltagare, att göra, datum och plats utan nollställning nekas', async () => {
    await seed(stored({ adjusterApprovedAt: OLD }));
    const stamp = { updatedBy: 'board', updatedAt: serverTimestamp() };
    await assertFails(updateDoc(ref(as('board')), { attendees: [], ...stamp }));
    await assertFails(updateDoc(ref(as('board')), { todos: [], ...stamp }));
    await assertFails(updateDoc(ref(as('board')), { meetingAt: OLD, ...stamp }));
    await assertFails(updateDoc(ref(as('board')), { location: 'Annan', ...stamp }));
  });
  it('sekreterare == justerare nekas', async () => {
    await seed();
    await assertFails(save('board', { adjusterUid: 'sec' }));
    await assertFails(save('board', { secretaryUid: 'adj' }));
  });
  it('createdBy/createdAt får inte ändras', async () => {
    await seed();
    await assertFails(save('board', { createdBy: 'super' }));
    await assertFails(save('board', { createdAt: serverTimestamp() }));
  });
  it('annan updatedBy eller updatedAt från klienten nekas', async () => {
    await seed();
    await assertFails(save('board', { updatedBy: 'sec' }));
    await assertFails(save('board', { updatedAt: OLD }));
  });
  it('okänt fält eller borttagen nyckel nekas', async () => {
    await seed();
    await assertFails(save('board', { extra: 1 }));
    await assertFails(save('board', { status: 'locked' }));
    const { body: _body, ...rest } = stored();
    await assertFails(setDoc(ref(as('board')), { ...rest, updatedBy: 'board', updatedAt: serverTimestamp() }));
  });
});

describe('protocols: godkännande', () => {
  beforeEach(() => seed());

  it('sekreteraren godkänner sin del', async () => {
    await assertSucceeds(approve('sec', 'secretaryApprovedAt'));
  });
  it('justeraren godkänner sin del', async () => {
    await assertSucceeds(approve('adj', 'adjusterApprovedAt'));
  });
  it('fel person kan inte godkänna', async () => {
    await assertFails(approve('adj', 'secretaryApprovedAt'));
    await assertFails(approve('sec', 'adjusterApprovedAt'));
    for (const uid of ['board', 'super', 'publisher', 'member']) {
      await assertFails(approve(uid, 'secretaryApprovedAt'));
      await assertFails(approve(uid, 'adjusterApprovedAt'));
    }
  });
  it('oinloggad kan inte godkänna', async () => {
    await assertFails(updateDoc(ref(anon()), { secretaryApprovedAt: serverTimestamp() }));
  });
  it('utsedd sekreterare som förlorat styrelsebehörighet kan inte godkänna', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', 'sec'), { permissions: ['member'] });
    });
    await assertFails(approve('sec', 'secretaryApprovedAt'));
  });
  it('tidsstämpel från klienten nekas', async () => {
    await assertFails(updateDoc(ref(as('sec')), { secretaryApprovedAt: OLD }));
    await assertFails(updateDoc(ref(as('sec')), { secretaryApprovedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref(as('sec')), { secretaryApprovedAt: true }));
  });
  it('godkännande som ändrar något annat nekas', async () => {
    await assertFails(approve('sec', 'secretaryApprovedAt', { body: 'Annan text' }));
    await assertFails(approve('sec', 'secretaryApprovedAt', { updatedBy: 'sec', updatedAt: serverTimestamp() }));
    await assertFails(approve('sec', 'secretaryApprovedAt', { adjusterApprovedAt: serverTimestamp() }));
    await assertFails(approve('sec', 'secretaryApprovedAt', { adjusterUid: 'board' }));
    await assertFails(approve('sec', 'secretaryApprovedAt', { secretaryUid: 'sec', adjusterUid: 'sec' }));
    await assertFails(approve('sec', 'secretaryApprovedAt', { extra: 1 }));
  });
  it('sekreterare som byter sig själv till justerare och godkänner båda nekas', async () => {
    await assertFails(
      updateDoc(ref(as('sec')), { adjusterUid: 'sec', secretaryApprovedAt: serverTimestamp(), adjusterApprovedAt: serverTimestamp() }),
    );
  });
  it('dubbelt godkännande (redan godkänt) nekas', async () => {
    await seed(stored({ secretaryApprovedAt: OLD }));
    await assertFails(approve('sec', 'secretaryApprovedAt'));
  });
  it('protokoll där sekreterare == justerare (felaktigt lagrat) kan inte godkännas', async () => {
    await seed(stored({ adjusterUid: 'sec' }));
    await assertFails(approve('sec', 'secretaryApprovedAt'));
    await assertFails(approve('sec', 'adjusterApprovedAt'));
  });
  it('utan utsedd sekreterare kan ingen godkänna dess del', async () => {
    await seed(stored({ secretaryUid: null, secretaryName: '' }));
    await assertFails(approve('sec', 'secretaryApprovedAt'));
    await assertFails(approve('board', 'secretaryApprovedAt'));
  });
});

describe('protocols: tillbakadragande', () => {
  it('den som godkänt får dra tillbaka sitt eget godkännande', async () => {
    await seed(stored({ secretaryApprovedAt: OLD }));
    await assertSucceeds(revoke('sec', 'secretaryApprovedAt'));
    await seed(stored({ adjusterApprovedAt: OLD }));
    await assertSucceeds(revoke('adj', 'adjusterApprovedAt'));
  });
  it('annan person kan inte dra tillbaka ett godkännande direkt', async () => {
    await seed(stored({ secretaryApprovedAt: OLD }));
    await assertFails(revoke('adj', 'secretaryApprovedAt'));
    await assertFails(revoke('board', 'secretaryApprovedAt'));
  });
  it('tillbakadragande som ändrar något annat nekas', async () => {
    await seed(stored({ secretaryApprovedAt: OLD }));
    await assertFails(updateDoc(ref(as('sec')), { secretaryApprovedAt: null, body: 'Ändrad' }));
  });
});

describe('protocols: låst', () => {
  it('båda godkänner i tur och ordning, sedan är protokollet låst', async () => {
    await seed();
    await assertSucceeds(approve('sec', 'secretaryApprovedAt'));
    await assertSucceeds(approve('adj', 'adjusterApprovedAt'));
    for (const uid of ['board', 'super', 'sec', 'adj']) {
      await assertFails(save(uid, { body: 'Ändring efter låsning' }));
      await assertFails(deleteDoc(ref(as(uid))));
    }
    await assertFails(revoke('sec', 'secretaryApprovedAt'));
    await assertFails(revoke('adj', 'adjusterApprovedAt'));
  });
  it('ingen ändring alls på låst protokoll', async () => {
    await seed(lockedDoc());
    const stamp = { updatedBy: 'board', updatedAt: serverTimestamp() };
    await assertFails(save('board'));
    await assertFails(updateDoc(ref(as('board')), { todos: [], ...stamp }));
    await assertFails(updateDoc(ref(as('board')), { secretaryApprovedAt: null, adjusterApprovedAt: null, ...stamp }));
    await assertFails(updateDoc(ref(as('sec')), { secretaryApprovedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref(as('super')), { secretaryUid: 'super' }));
  });
  it('låst protokoll kan inte raderas', async () => {
    await seed(lockedDoc());
    for (const uid of ['board', 'super', 'sec', 'adj']) {
      await assertFails(deleteDoc(ref(as(uid))));
    }
  });
  it('låst protokoll kan fortfarande läsas', async () => {
    await seed(lockedDoc());
    await assertSucceeds(getDoc(ref(as('board'))));
  });
  it('rättelse görs som nytt protokoll (kopia) och tillåts', async () => {
    await seed(lockedDoc());
    await assertSucceeds(setDoc(ref(as('board'), 'p2'), newProtocol('board', { body: 'Rättelse till protokoll p1' })));
  });
});

describe('protocols: delete', () => {
  it('board och superadmin kan radera utkast utan godkännanden', async () => {
    await seed();
    await assertSucceeds(deleteDoc(ref(as('board'))));
    await seed();
    await assertSucceeds(deleteDoc(ref(as('super'))));
  });
  it('utkast med ett godkännande kan inte raderas', async () => {
    await seed(stored({ secretaryApprovedAt: OLD }));
    await assertFails(deleteDoc(ref(as('board'))));
    await seed(stored({ adjusterApprovedAt: OLD }));
    await assertFails(deleteDoc(ref(as('board'))));
  });
  it('andra än styrelse/superadmin kan inte radera', async () => {
    await seed();
    for (const db of [as('publisher'), as('member'), as('setter'), as('nobody'), anon(), ghost()]) {
      await assertFails(deleteDoc(ref(db)));
    }
  });
});

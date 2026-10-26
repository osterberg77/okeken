import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;
const USERS: Record<string, { permissions: string[]; hidden?: boolean }> = {
  anna: { permissions: ['member'] },
  bo: { permissions: ['member'] },
  secret: { permissions: ['member'], hidden: true },
  board: { permissions: ['board'] },
  publisher: { permissions: ['publisher'] },
  plain: { permissions: [] },
};
const pair = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`);

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-okeken', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, u] of Object.entries(USERS)) {
      await setDoc(doc(db, 'users', uid), { displayName: uid, email: `${uid}@example.com`, ...u });
      if (u.permissions.length) await setDoc(doc(db, 'members', uid), { displayName: uid, publicName: true, hidden: u.hidden === true });
    }
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

/** Skickar ett meddelande som ett par skrivningar i samma batch (så som klienten gör) */
function send(uid: string, other: string, over: Record<string, unknown> = {}, exists = false, convOver: Record<string, unknown> = {}) {
  const db = as(uid);
  const id = pair(uid, other);
  const conv = doc(db, 'conversations', id);
  const batch = writeBatch(db);
  const summary = { lastMessageAt: serverTimestamp(), lastSenderUid: uid, lastText: 'Hej', readAt: { [uid]: serverTimestamp() }, ...convOver };
  // Vid uppdatering ändras bara den egna läsmarkeringen (punktnotation), annars skulle motpartens markering skrivas över
  if (exists) batch.update(conv, { lastMessageAt: summary.lastMessageAt, lastSenderUid: summary.lastSenderUid, lastText: summary.lastText, [`readAt.${uid}`]: serverTimestamp(), ...convOver });
  else batch.set(conv, { participants: [uid, other].sort(), ...summary });
  batch.set(doc(collection(conv, 'messages')), { senderUid: uid, text: 'Hej', kind: 'text', createdAt: serverTimestamp(), ...over });
  return batch.commit();
}

async function seedConversation(a: string, b: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const ref = doc(db, 'conversations', pair(a, b));
    await setDoc(ref, { participants: [a, b].sort(), lastMessageAt: new Date(), lastSenderUid: a, lastText: 'Hej', readAt: { [a]: new Date() } });
    await setDoc(doc(ref, 'messages', 'm1'), { senderUid: a, text: 'Hej', kind: 'text', createdAt: new Date() });
  });
}

describe('starta konversation', () => {
  it('en medlem kan skriva till en annan medlem', async () => {
    await assertSucceeds(send('anna', 'bo'));
  });
  it('den som saknar behörighet kan inte starta en konversation', async () => {
    await assertFails(send('plain', 'bo'));
  });
  it('vanliga medlemmar når inte en dold person, men publicerare och styrelse gör det', async () => {
    await assertFails(send('anna', 'secret'));
    await assertSucceeds(send('board', 'secret'));
    await assertSucceeds(send('publisher', 'secret'));
  });
  it('en dold person kan själv skriva till andra', async () => {
    await assertSucceeds(send('secret', 'anna'));
  });
  it('mottagaren måste finnas, och man skriver inte till sig själv', async () => {
    await assertFails(send('anna', 'nobody'));
    const db = as('anna');
    const batch = writeBatch(db);
    batch.set(doc(db, 'conversations', 'anna_anna'), { participants: ['anna', 'anna'], lastMessageAt: serverTimestamp(), lastSenderUid: 'anna', lastText: 'x', readAt: { anna: serverTimestamp() } });
    await assertFails(batch.commit());
  });
  it('avsändaren är alltid den inloggade och id:t följer deltagarna', async () => {
    await assertFails(send('anna', 'bo', { senderUid: 'bo' }));
    await assertFails(send('anna', 'bo', {}, false, { lastSenderUid: 'bo' }));
    const db = as('anna');
    const batch = writeBatch(db);
    batch.set(doc(db, 'conversations', 'felaktigt-id'), { participants: ['anna', 'bo'], lastMessageAt: serverTimestamp(), lastSenderUid: 'anna', lastText: 'x', readAt: { anna: serverTimestamp() } });
    await assertFails(batch.commit());
  });
  it('tomma och för långa meddelanden nekas, text ska vara text', async () => {
    await assertFails(send('anna', 'bo', { text: '' }));
    await assertFails(send('anna', 'bo', { text: 'x'.repeat(1001) }));
    await assertFails(send('anna', 'bo', { text: 5 }));
    await assertSucceeds(send('anna', 'bo', { text: '👍'.repeat(400) }));
  });
  it('ett meddelande utan konversationsuppdatering nekas, och tiden sätts av servern', async () => {
    const db = as('anna');
    await seedConversation('anna', 'bo');
    await assertFails(setDoc(doc(db, 'conversations', pair('anna', 'bo'), 'messages', 'x'), { senderUid: 'anna', text: 'Hej', kind: 'text', createdAt: serverTimestamp() }));
    await assertFails(send('anna', 'bo', { createdAt: new Date() }, true));
  });
  it('automatiska meddelanden: bara från publicerare och uppåt, med säker länk', async () => {
    await assertFails(send('anna', 'bo', { kind: 'notice' }));
    await assertSucceeds(send('board', 'anna', { kind: 'notice', link: '/profil' }));
    await assertFails(send('board', 'bo', { kind: 'notice', link: 'https://evil.example.com' }));
    await assertFails(send('board', 'bo', { kind: 'notice', link: '//evil.example.com' }));
    await assertFails(send('board', 'bo', { kind: 'text', link: '/profil' }));
  });
});

describe('läsa och svara', () => {
  it('bara deltagarna läser konversation och meddelanden', async () => {
    await seedConversation('anna', 'bo');
    for (const uid of ['anna', 'bo']) {
      await assertSucceeds(getDoc(doc(as(uid), 'conversations', pair('anna', 'bo'))));
      await assertSucceeds(getDocs(collection(as(uid), 'conversations', pair('anna', 'bo'), 'messages')));
    }
    await assertFails(getDoc(doc(as('board'), 'conversations', pair('anna', 'bo'))));
    await assertFails(getDocs(collection(as('board'), 'conversations', pair('anna', 'bo'), 'messages')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'conversations', pair('anna', 'bo'))));
  });
  it('en lista över egna konversationer går att fråga efter, men inte andras', async () => {
    await seedConversation('anna', 'bo');
    await assertSucceeds(getDocs(query(collection(as('anna'), 'conversations'), where('participants', 'array-contains', 'anna'))));
    await assertFails(getDocs(query(collection(as('anna'), 'conversations'), where('participants', 'array-contains', 'bo'))));
    await assertFails(getDocs(collection(as('anna'), 'conversations')));
  });
  it('mottagaren kan svara, även utan behörighet', async () => {
    await seedConversation('plain', 'bo');
    await assertSucceeds(send('plain', 'bo', {}, true));
    await assertSucceeds(send('bo', 'plain', {}, true));
  });
  it('en utomstående kan inte skriva i någon annans konversation', async () => {
    await seedConversation('anna', 'bo');
    // 'board' är inte deltagare i anna_bo: skrivningen riktas mot den konversationen med board som avsändare
    const db = as('board');
    const conv = doc(db, 'conversations', pair('anna', 'bo'));
    const batch = writeBatch(db);
    batch.update(conv, { lastMessageAt: serverTimestamp(), lastSenderUid: 'board', lastText: 'Hej', 'readAt.board': serverTimestamp() });
    batch.set(doc(collection(conv, 'messages')), { senderUid: 'board', text: 'Hej', kind: 'text', createdAt: serverTimestamp() });
    await assertFails(batch.commit());
  });
  it('markera som läst: bara sin egen läsmarkering, med serverns tid', async () => {
    await seedConversation('anna', 'bo');
    const ref = (uid: string) => doc(as(uid), 'conversations', pair('anna', 'bo'));
    await assertSucceeds(updateDoc(ref('bo'), { 'readAt.bo': serverTimestamp() }));
    await assertFails(updateDoc(ref('bo'), { 'readAt.anna': serverTimestamp() }));
    await assertFails(updateDoc(ref('bo'), { 'readAt.bo': new Date(0) }));
    await assertFails(updateDoc(ref('board'), { 'readAt.board': serverTimestamp() }));
  });
  it('meddelanden går inte att ändra eller radera, och konversationer går inte att radera', async () => {
    await seedConversation('anna', 'bo');
    const msg = doc(as('anna'), 'conversations', pair('anna', 'bo'), 'messages', 'm1');
    await assertFails(updateDoc(msg, { text: 'ändrat' }));
    await assertFails(deleteDoc(msg));
    await assertFails(deleteDoc(doc(as('anna'), 'conversations', pair('anna', 'bo'))));
  });
});

describe('medlemskatalogen och dolda', () => {
  it('en medlem listar bara dem som inte är dolda', async () => {
    const db = as('anna');
    await assertSucceeds(getDocs(query(collection(db, 'members'), where('hidden', '==', false))));
    await assertFails(getDocs(collection(db, 'members')));
    await assertFails(getDoc(doc(db, 'members', 'secret')));
    await assertSucceeds(getDoc(doc(db, 'members', 'bo')));
    await assertSucceeds(getDoc(doc(db, 'members', 'anna')));
  });
  it('en medlem ser den dolda personen om de redan har en konversation', async () => {
    await seedConversation('anna', 'secret');
    await assertSucceeds(getDoc(doc(as('anna'), 'members', 'secret')));
    await assertFails(getDoc(doc(as('bo'), 'members', 'secret')));
  });
  it('den utan behörighet ser namnet på den hen har en konversation med, men inte andra', async () => {
    await seedConversation('plain', 'board');
    await assertSucceeds(getDoc(doc(as('plain'), 'members', 'board')));
    await assertFails(getDoc(doc(as('plain'), 'members', 'anna')));
  });
  it('publicerare och styrelse läser alla, den utan behörighet ingen', async () => {
    for (const uid of ['publisher', 'board']) await assertSucceeds(getDocs(collection(as(uid), 'members')));
    await assertFails(getDocs(query(collection(as('plain'), 'members'), where('hidden', '==', false))));
  });
});

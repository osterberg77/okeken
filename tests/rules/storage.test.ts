import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { deleteObject, getBytes, listAll, ref, updateMetadata, uploadBytes } from 'firebase/storage';

let env: RulesTestEnvironment;

const USERS: Record<string, string[]> = {
  publisher: ['publisher'],
  board: ['board'],
  super: ['superadmin'],
  setter: ['course_setter'],
  member: ['member'],
  nobody: [],
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Storage-emulatorn slår upp användare i Firestore under --project (demo-okeken); filerna körs en i taget
    projectId: 'demo-okeken',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, permissions] of Object.entries(USERS)) {
      await setDoc(doc(ctx.firestore(), 'users', uid), {
        displayName: uid,
        email: `${uid}@example.com`,
        permissions,
        createdAt: Timestamp.now(),
      });
    }
    await uploadBytes(ref(ctx.storage(), 'courses/ev1/existing-Bana.pdf'), pdf(), { contentType: 'application/pdf' });
    await uploadBytes(ref(ctx.storage(), 'other/secret.txt'), new Uint8Array([1]), { contentType: 'text/plain' });
  });
});

let n = 0;
/** Unikt filnamn per anrop: emulatorn rensar inte alltid Storage mellan tester */
const fresh = (dir = 'courses/ev1') => `${dir}/t${Date.now()}-${n++}-Bana.pdf`;
const pdf = (bytes = 100) => new Uint8Array(bytes).fill(37);
const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).storage();
const anon = () => env.unauthenticatedContext().storage();
const ghost = () => env.authenticatedContext('ghost', { email_verified: true }).storage();

const put = (s: ReturnType<typeof as>, path: string, data: Uint8Array = pdf(), contentType = 'application/pdf') =>
  uploadBytes(ref(s, path), data, { contentType });

describe('storage: courses – uppladdning', () => {
  for (const uid of ['publisher', 'board', 'super', 'setter']) {
    it(`${uid} kan ladda upp en PDF`, async () => {
      await assertSucceeds(put(as(uid), fresh()));
    });
  }
  for (const uid of ['member', 'nobody']) {
    it(`${uid} kan inte ladda upp`, async () => {
      await assertFails(put(as(uid), fresh()));
    });
  }
  it('användare utan dokument och utloggade kan inte ladda upp', async () => {
    await assertFails(put(ghost(), 'courses/ev1/abc.pdf'));
    await assertFails(put(anon(), 'courses/ev1/abc.pdf'));
  });
  it('bara PDF (typ och ändelse)', async () => {
    await assertFails(put(as('publisher'), 'courses/ev1/abc.pdf', pdf(), 'text/html'));
    await assertFails(put(as('publisher'), 'courses/ev1/abc.html', pdf(), 'application/pdf'));
    await assertFails(put(as('publisher'), 'courses/ev1/abc.pdf.exe', pdf(), 'application/pdf'));
    await assertFails(put(as('publisher'), 'courses/ev1/abc', pdf(), 'application/pdf'));
    await assertFails(put(as('publisher'), 'courses/ev1/a b.pdf'));
  });
  it('högst 10 MB och inte tom', async () => {
    await assertSucceeds(put(as('publisher'), fresh(), pdf(10 * 1024 * 1024)));
    await assertFails(put(as('publisher'), 'courses/ev1/for-stor.pdf', pdf(10 * 1024 * 1024 + 1)));
    await assertFails(put(as('publisher'), 'courses/ev1/tom.pdf', pdf(0)));
  });
  it('skriver inte över och raderar inte befintliga filer', async () => {
    for (const uid of ['publisher', 'board', 'super', 'setter']) {
      await assertFails(put(as(uid), 'courses/ev1/existing-Bana.pdf'));
      await assertFails(deleteObject(ref(as(uid), 'courses/ev1/existing-Bana.pdf')));
    }
  });
  it('ingen extra metadata (contentDisposition, customMetadata, contentEncoding)', async () => {
    const withMeta = (m: Record<string, unknown>) => uploadBytes(ref(as('publisher'), fresh()), pdf(), { contentType: 'application/pdf', ...m });
    await assertFails(withMeta({ contentDisposition: 'attachment; filename="evil.html"' }));
    await assertFails(withMeta({ contentEncoding: 'gzip' }));
    await assertFails(withMeta({ customMetadata: { a: 'b' } }));
  });
  it('metadata på befintlig fil kan inte ändras', async () => {
    for (const uid of ['publisher', 'super']) {
      await assertFails(updateMetadata(ref(as(uid), 'courses/ev1/existing-Bana.pdf'), { contentType: 'text/html' }));
    }
  });
  it('konstiga eventId och filnamn nekas', async () => {
    await assertFails(put(as('super'), 'courses/.._x/abc.pdf'));
    await assertFails(put(as('super'), 'courses/ev%2F1/abc.pdf'));
    await assertFails(put(as('super'), `courses/${'e'.repeat(65)}/abc.pdf`));
    await assertFails(put(as('super'), 'courses/ev1/..pdf'));
    await assertFails(put(as('super'), 'courses/ev1/.pdf'));
  });
  it('användare med trasig permissions-lista kan inte ladda upp', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'broken1'), { permissions: 'publisher' });
      await setDoc(doc(ctx.firestore(), 'users', 'broken2'), { displayName: 'x' });
    });
    await assertFails(put(as('broken1'), fresh()));
    await assertFails(put(as('broken2'), fresh()));
  });
  it('inga underkataloger och inga andra sökvägar', async () => {
    await assertFails(put(as('super'), 'courses/ev1/sub/abc.pdf'));
    await assertFails(put(as('super'), 'courses/abc.pdf'));
    await assertFails(put(as('super'), 'images/abc.pdf'));
    await assertFails(put(as('super'), 'abc.pdf'));
  });
});

describe('storage: läsning', () => {
  it('alla kan läsa banor, även utloggade', async () => {
    await assertSucceeds(getBytes(ref(anon(), 'courses/ev1/existing-Bana.pdf')));
    await assertSucceeds(getBytes(ref(as('nobody'), 'courses/ev1/existing-Bana.pdf')));
  });
  it('ingen kan lista filer, inte ens superadmin', async () => {
    for (const s of [anon(), as('nobody'), as('super')]) {
      await assertFails(listAll(ref(s, 'courses/ev1')));
      await assertFails(listAll(ref(s, 'courses')));
    }
  });
  it('övriga sökvägar kan inte läsas av någon', async () => {
    for (const s of [anon(), as('super')]) {
      await assertFails(getBytes(ref(s, 'other/secret.txt')));
    }
  });
});

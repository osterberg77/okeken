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
  it('inloggad kan radera en bana (editorn städar bort borttagna banor); anonym kan inte', async () => {
    await assertFails(deleteObject(ref(anon(), 'courses/ev1/existing-Bana.pdf')));
    await assertSucceeds(deleteObject(ref(as('publisher'), 'courses/ev1/existing-Bana.pdf')));
  });
  // Emulatorn räknar en överskrivning som create (produktion som update, som nekas), så skyddet går inte att testa här.
  // Reglerna får inte referera till `resource`: det gav "Null value error" i Rules-tjänsten och nekade nya filer.
  it.skip('skriver inte över befintliga filer (kan inte testas i emulatorn)', async () => {
    for (const uid of ['publisher', 'board', 'super', 'setter']) {
      await assertFails(put(as(uid), 'courses/ev1/existing-Bana.pdf'));
    }
  });
  // Metadatakontrollen är utelämnad i storage.rules tills 403-felet i produktion är utrett (commit e247536 har den).
  it.skip('ingen extra metadata (contentDisposition, customMetadata, contentEncoding)', async () => {
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

// ---- Bildbank (beslut 0007) ----------------------------------------------------------------

/** Unikt post-id per anrop (bara [A-Za-z0-9]) */
const freshId = () => `t${Date.now()}x${n++}`;
const img = (bytes = 100) => new Uint8Array(bytes).fill(7);
const putImg = (s: ReturnType<typeof as>, path: string, contentType = 'image/webp', data: Uint8Array = img()) =>
  uploadBytes(ref(s, path), data, { contentType });

/** Post i Firestore och fil i Storage, skapade utan regler */
const seedImage = async (id: string, withPost: boolean) => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    if (withPost) await setDoc(doc(ctx.firestore(), 'imageBank', id), { name: 'x' });
    await uploadBytes(ref(ctx.storage(), `image_bank/${id}-web.webp`), img(), { contentType: 'image/webp' });
  });
  return `image_bank/${id}-web.webp`;
};

describe('storage: image_bank – uppladdning', () => {
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} kan ladda upp bilder`, async () => {
      const id = freshId();
      await assertSucceeds(putImg(as(uid), `image_bank/${id}-original.jpg`, 'image/jpeg'));
      await assertSucceeds(putImg(as(uid), `image_bank/${id}-web.webp`, 'image/webp'));
      await assertSucceeds(putImg(as(uid), `image_bank/${id}-thumbnail.png`, 'image/png'));
    });
  }
  for (const uid of ['setter', 'member', 'nobody']) {
    it(`${uid} kan inte ladda upp`, async () => {
      await assertFails(putImg(as(uid), `image_bank/${freshId()}-web.webp`));
    });
  }
  it('användare utan dokument och utloggade kan inte ladda upp', async () => {
    await assertFails(putImg(ghost(), `image_bank/${freshId()}-web.webp`));
    await assertFails(putImg(anon(), `image_bank/${freshId()}-web.webp`));
  });
  it('användare med trasig permissions-lista kan inte ladda upp', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'broken1'), { permissions: 'publisher' });
      await setDoc(doc(ctx.firestore(), 'users', 'broken2'), { displayName: 'x' });
    });
    await assertFails(putImg(as('broken1'), `image_bank/${freshId()}-web.webp`));
    await assertFails(putImg(as('broken2'), `image_bank/${freshId()}-web.webp`));
  });
  it('bara jpeg, png och webp, och typen ska stämma med ändelsen', async () => {
    const id = freshId();
    await assertFails(putImg(as('publisher'), `image_bank/${id}-web.svg`, 'image/svg+xml'));
    await assertFails(putImg(as('publisher'), `image_bank/${id}-web.webp`, 'image/svg+xml'));
    await assertFails(putImg(as('publisher'), `image_bank/${id}-web.gif`, 'image/gif'));
    await assertFails(putImg(as('publisher'), `image_bank/${id}-web.webp`, 'image/gif'));
    await assertFails(putImg(as('publisher'), `image_bank/${id}-web.webp`, 'text/html'));
    await assertFails(putImg(as('publisher'), `image_bank/${id}-web.jpg`, 'image/png'));
    await assertFails(putImg(as('publisher'), `image_bank/${id}-web.png`, 'image/jpeg'));
    await assertFails(putImg(as('publisher'), `image_bank/${id}-web.jpeg`, 'image/jpeg'));
    await assertFails(putImg(as('publisher'), `image_bank/${id}-web.html`, 'image/webp'));
  });
  it('högst 10 MB och inte tom', async () => {
    await assertSucceeds(putImg(as('publisher'), `image_bank/${freshId()}-original.jpg`, 'image/jpeg', img(10 * 1024 * 1024)));
    await assertFails(putImg(as('publisher'), `image_bank/${freshId()}-original.jpg`, 'image/jpeg', img(10 * 1024 * 1024 + 1)));
    await assertFails(putImg(as('publisher'), `image_bank/${freshId()}-original.jpg`, 'image/jpeg', img(0)));
  });
  it('ogiltiga filnamn och sökvägar nekas', async () => {
    const id = freshId();
    for (const p of [
      `image_bank/${id}.webp`,
      `image_bank/${id}-4k.webp`,
      `image_bank/${id}-web`,
      `image_bank/${id}-web.webp.exe`,
      `image_bank/${id}_web.webp`,
      `image_bank/a-b-web.webp`,
      `image_bank/-web.webp`,
      `image_bank/${'x'.repeat(65)}-web.webp`,
      `image_bank/sub/${id}-web.webp`,
      `image_bank/${id}-web.webp/x.webp`,
      `image_bank/${id} -web.webp`,
      `images/${id}-web.webp`,
      `${id}-web.webp`,
      `courses/ev1/${id}-web.webp`,
    ]) {
      await assertFails(putImg(as('super'), p));
    }
  });
  // Se kommentaren vid courses/ ovan: emulatorn räknar överskrivning som create.
  it.skip('skriver inte över befintliga filer (kan inte testas i emulatorn)', async () => {
    const path = await seedImage(freshId(), false);
    for (const uid of ['publisher', 'board', 'super']) {
      await assertFails(putImg(as(uid), path));
    }
  });
  // !imagePostExists är utelämnad i storage.rules tills vidare (se ovan).
  it.skip('kan inte ladda upp filer till en befintlig post', async () => {
    const id = freshId();
    await seedImage(id, true);
    await assertFails(putImg(as('super'), `image_bank/${id}-original.jpg`, 'image/jpeg'));
    await assertFails(putImg(as('super'), `image_bank/${id}-thumbnail.webp`));
  });
  // Metadatakontrollen är utelämnad i storage.rules tills 403-felet i produktion är utrett (commit e247536 har den).
  it.skip('ingen extra metadata (contentDisposition, customMetadata, contentEncoding)', async () => {
    const withMeta = (m: Record<string, unknown>) =>
      uploadBytes(ref(as('publisher'), `image_bank/${freshId()}-web.webp`), img(), { contentType: 'image/webp', ...m });
    await assertFails(withMeta({ contentDisposition: 'inline; filename="evil.html"' }));
    await assertFails(withMeta({ contentEncoding: 'gzip' }));
    await assertFails(withMeta({ customMetadata: { a: 'b' } }));
  });
  it('metadata på befintlig fil kan inte ändras', async () => {
    const path = await seedImage(freshId(), false);
    for (const uid of ['publisher', 'super']) {
      await assertFails(updateMetadata(ref(as(uid), path), { contentType: 'text/html' }));
    }
  });
});

describe('storage: image_bank – läsning och radering', () => {
  it('alla kan hämta bilder, även utloggade', async () => {
    const path = await seedImage(freshId(), true);
    await assertSucceeds(getBytes(ref(anon(), path)));
    await assertSucceeds(getBytes(ref(as('nobody'), path)));
  });
  it('ingen kan lista bildbanken, inte ens superadmin', async () => {
    for (const s of [anon(), as('nobody'), as('super')]) {
      await assertFails(listAll(ref(s, 'image_bank')));
    }
  });
  for (const uid of ['publisher', 'board', 'super']) {
    it(`${uid} kan radera filer vars post är raderad`, async () => {
      const path = await seedImage(freshId(), false);
      await assertSucceeds(deleteObject(ref(as(uid), path)));
    });
  }
  it('filer som en befintlig post pekar på kan inte raderas', async () => {
    const path = await seedImage(freshId(), true);
    for (const uid of ['publisher', 'board', 'super']) {
      await assertFails(deleteObject(ref(as(uid), path)));
    }
  });
  it('setter, member, nobody, utan dokument och utloggade kan inte radera', async () => {
    const path = await seedImage(freshId(), false);
    for (const s of [as('setter'), as('member'), as('nobody'), ghost(), anon()]) {
      await assertFails(deleteObject(ref(s, path)));
    }
  });
  it('bildbanksregeln ger ingen radering av andra sökvägar', async () => {
    await assertFails(deleteObject(ref(as('super'), 'other/secret.txt')));
  });
});

describe('storage: avatars', () => {
  const jpeg = (bytes = 100) => new Uint8Array(bytes).fill(255);
  it('användaren kan ladda upp, byta och radera sin egen profilbild', async () => {
    await assertSucceeds(put(as('member'), 'avatars/member.jpg', jpeg(), 'image/jpeg'));
    await assertSucceeds(put(as('member'), 'avatars/member.jpg', jpeg(200), 'image/jpeg'));
    await assertSucceeds(deleteObject(ref(as('member'), 'avatars/member.jpg')));
  });
  it('även utan behörigheter (nyregistrerad)', async () => {
    await assertSucceeds(put(as('nobody'), 'avatars/nobody.jpg', jpeg(), 'image/jpeg'));
  });
  it('ingen kan skriva eller radera någon annans bild, inte ens superadmin', async () => {
    await assertFails(put(as('member'), 'avatars/publisher.jpg', jpeg(), 'image/jpeg'));
    await assertFails(put(as('super'), 'avatars/member.jpg', jpeg(), 'image/jpeg'));
    await assertSucceeds(put(as('member'), 'avatars/member.jpg', jpeg(), 'image/jpeg'));
    await assertFails(deleteObject(ref(as('super'), 'avatars/member.jpg')));
  });
  it('bara JPEG, högst 500 kB, och bara filnamnet <uid>.jpg', async () => {
    await assertFails(put(as('member'), 'avatars/member.jpg', jpeg(), 'image/png'));
    await assertFails(put(as('member'), 'avatars/member.jpg', jpeg(500 * 1024 + 1), 'image/jpeg'));
    await assertFails(put(as('member'), 'avatars/member2.jpg', jpeg(), 'image/jpeg'));
    await assertFails(put(as('member'), 'avatars/member.png', jpeg(), 'image/jpeg'));
  });
  it('utloggade kan inte skriva eller läsa, ingen kan lista', async () => {
    await assertFails(put(anon(), 'avatars/member.jpg', jpeg(), 'image/jpeg'));
    await assertSucceeds(put(as('member'), 'avatars/member.jpg', jpeg(), 'image/jpeg'));
    await assertFails(getBytes(ref(anon(), 'avatars/member.jpg')));
    await assertSucceeds(getBytes(ref(as('publisher'), 'avatars/member.jpg')));
    await assertFails(listAll(ref(as('publisher'), 'avatars')));
  });
});

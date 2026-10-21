// Körs bara i bygget (Astro content loader). Läser den publicerade menyn (menu/main.published) med Admin SDK.
// Lokalt: `gcloud auth application-default login`, eller FIRESTORE_EMULATOR_HOST mot emulatorn.
// I CI: tjänstekontot via google-github-actions/auth.
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { MenuItem } from '../../types/menu';

/** Reglerna garanterar formen; detta skyddar bara bygget mot data skrivna förbi reglerna (Admin SDK) */
function toMenuItem(raw: unknown): MenuItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const { label, pageId, children } = raw as Record<string, unknown>;
  if (typeof label !== 'string' || !label.trim()) return [];
  return [
    {
      label: label.trim(),
      pageId: typeof pageId === 'string' && pageId ? pageId : null,
      children: Array.isArray(children) ? children.filter((c): c is string => typeof c === 'string' && c !== '') : [],
    },
  ];
}

/** En post med id 'main', eller ingen alls om menyn aldrig publicerats (då visas platshållarna) */
export async function loadPublishedMenu() {
  if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId: 'okeken' });

  let snap;
  try {
    snap = await getFirestore().doc('menu/main').get();
  } catch (err) {
    // Hellre ett misslyckat bygge än en deployad sajt med fel meny
    throw new Error(
      'Kunde inte läsa menu/main från Firestore. Lokalt: kör `gcloud auth application-default login` ' +
        `eller starta emulatorn (npm run dev:emu). Orsak: ${(err as Error).message}`,
    );
  }

  const published = snap.get('published') as { items?: unknown } | null | undefined;
  if (!published || !Array.isArray(published.items)) return [];
  return [{ id: 'main', items: published.items.flatMap(toMenuItem) }];
}

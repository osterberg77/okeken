/** 'Tisdagsträning vecka 39' → 'tisdagstraning-vecka-39' */
export function slugify(text: string, max = 80): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // å ä ö é → a a o e
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

/** Stabil eventadress: '<datum>-<titel>', t.ex. '2026-09-22-tisdagstraning-vecka-39' */
export function eventSlug(startDay: string, title: string): string {
  const base = slugify(title);
  return base ? `${startDay}-${base}` : startDay;
}

/**
 * Adresser som infosidor (/<slug>) inte får använda: sajtens egna sidor och mappar samt omdirigeringar i firebase.json.
 * Håll listan synkad med reservedPageSlugs() i firestore.rules (reglerna är skyddet, listan här är för UI:t).
 */
export const RESERVED_PAGE_SLUGS: readonly string[] = [
  'event',
  'admin',
  'sok',
  'logga-in',
  'pagefind',
  'api',
  'assets',
  '404',
  'index',
  'kalender',
  'traningskalender',
  'medlemsavgift',
  'ute',
];

/**
 * Fasta sidor (beslut 0023): adresser som har en egen route med en inbyggd widget. Texten (titel och ingress) är en vanlig
 * infosida med den här adressen, skapad av scripts/seed-fixed-pages.mjs. Adresserna är reserverade så att ingen skapar dem
 * för hand, och bygget hoppar över dem i [slug].astro.
 */
export const FIXED_PAGE_SLUGS: readonly string[] = ['ute', 'medlemsavgift'];

export const isFixedPageSlug = (slug: string) => FIXED_PAGE_SLUGS.includes(slug);

export const isReservedPageSlug = (slug: string) => RESERVED_PAGE_SLUGS.includes(slug);

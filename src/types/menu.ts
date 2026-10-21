/**
 * Huvudmenyn, Firestore `menu/main` (beslut 0008). Kalendern (startsidan) är fast första post och lagras inte.
 * Gränserna kontrolleras i firestore.rules; håll dem synkade.
 */

/** En post i menyn: en sida med egen länk och/eller en rubrik för en undermeny */
export interface MenuItem {
  /** Text i menyn, 1–40 tecken */
  label: string;
  /** Dokument-id i `pages`, eller null för en rubrik utan egen sida */
  pageId: string | null;
  /** Undermeny: dokument-id i `pages`, högst 8. Ingen tredje nivå. Texten är sidans titel */
  children: string[];
}

/** Det som är live: exakt kopia av utkastet vid publicering */
export interface MenuSnapshot {
  items: MenuItem[];
}

export interface MenuRecord {
  /** Utkastet */
  items: MenuItem[];
  /** null tills menyn publicerats första gången */
  published: MenuSnapshot | null;
  publishedAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export const MAX_MENU_ITEMS = 8;
export const MAX_MENU_CHILDREN = 8;
export const MAX_MENU_LABEL = 40;
/** Samma format som reglerna kräver av sid-id:n i menyn */
export const MENU_PAGE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Sida som menyn kan peka på: det bygget (eller adminvyn) vet om publicerade sidor */
export interface MenuPageRef {
  pageId: string;
  slug: string;
  title: string;
}

/** Länk i den färdiga menyn */
export interface MenuLink {
  label: string;
  href: string;
}

/** Toppnivåpost i den färdiga menyn. href null = rubrik utan egen sida (har då alltid minst ett barn) */
export interface PublicMenuItem {
  label: string;
  href: string | null;
  children: MenuLink[];
}

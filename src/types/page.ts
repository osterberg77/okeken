/** Redigerbart innehåll i en infosida. Alla fält finns alltid (se firestore.rules). */
export interface PageContent {
  title: string;
  /** Markdown, högst 50 000 tecken */
  body: string;
  inMenu: boolean;
  /** Heltal 0–999, lägst först i menyn */
  menuOrder: number;
  /** Text i menyn, högst 40 tecken. Tom = använd `title` */
  menuLabel: string;
}

export const MAX_PAGE_BODY = 50000;
export const MAX_MENU_LABEL = 40;
export const MAX_MENU_ORDER = 999;

/**
 * - draft: aldrig publicerad
 * - published: live (utkastet kan ha opublicerade ändringar)
 * - unpublished: avpublicerad, syns inte för besökare
 */
export type PageStatus = 'draft' | 'published' | 'unpublished';

export interface PageRecord extends PageContent {
  id: string;
  status: PageStatus;
  /** Adress /<slug>. Sätts vid första publiceringen och låses därefter; får inte vara reserverad (src/lib/slug.ts) */
  slug: string | null;
  published: PageContent | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
}

/** Publicerad sida i serialiserbar form – det som bygget skickar till sidor och meny. */
export interface PublicPage {
  slug: string;
  title: string;
  bodyHtml: string;
  /** Kort klartext för Open Graph */
  excerpt: string;
  inMenu: boolean;
  menuOrder: number;
  menuLabel: string;
}

/** Menypost för en infosida */
export interface MenuPage {
  slug: string;
  href: string;
  label: string;
}

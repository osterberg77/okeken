/** Redigerbart innehåll i en infosida. Alla fält finns alltid (se firestore.rules). */
export interface PageContent {
  title: string;
  /** Markdown, högst 50 000 tecken */
  body: string;
}

/** Var en sida visas i menyn bestäms av `menu/main` (src/types/menu.ts, beslut 0008), inte av sidan. */

export const MAX_PAGE_BODY = 50000;

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

/** Publicerad sida i serialiserbar form – det som bygget skickar till sidorna. */
export interface PublicPage {
  slug: string;
  title: string;
  bodyHtml: string;
  /** Kort klartext för Open Graph */
  excerpt: string;
}

import { getCollection } from 'astro:content';
import { renderMarkdown, toExcerpt } from './markdown';
import type { MenuPage, PublicPage } from '../types/page';

/** Alla publicerade infosidor. */
export async function getPublicPages(): Promise<PublicPage[]> {
  const entries = await getCollection('pages');
  return entries.map(({ id, data }) => ({
    slug: id,
    title: data.title,
    bodyHtml: renderMarkdown(data.body),
    excerpt: toExcerpt(data.body),
    inMenu: data.inMenu,
    menuOrder: data.menuOrder,
    menuLabel: data.menuLabel,
  }));
}

/** Menyposter för publicerade sidor med `inMenu`, sorterade på menuOrder och sedan titel. */
export async function getMenuPages(): Promise<MenuPage[]> {
  const pages = await getPublicPages();
  return pages
    .filter((p) => p.inMenu)
    .sort((a, b) => a.menuOrder - b.menuOrder || a.title.localeCompare(b.title, 'sv'))
    .map((p) => ({ slug: p.slug, href: `/${p.slug}`, label: p.menuLabel.trim() || p.title }));
}

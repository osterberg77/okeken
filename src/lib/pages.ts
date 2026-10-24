import { getCollection } from 'astro:content';
import { renderMarkdown, toExcerpt } from './markdown';
import type { PublicPage } from '../types/page';

/** Texten till en fast sida (beslut 0023), eller null om den inte är publicerad. Routen visar då widgeten med standardtext. */
export async function getFixedPage(slug: string): Promise<PublicPage | null> {
  return (await getPublicPages()).find((p) => p.slug === slug) ?? null;
}

/** Alla publicerade infosidor. Menyn byggs av getMenu() i src/lib/menu.ts. */
export async function getPublicPages(): Promise<PublicPage[]> {
  const entries = await getCollection('pages');
  return entries.map(({ data }) => ({
    slug: data.slug,
    title: data.title,
    bodyHtml: renderMarkdown(data.body),
    excerpt: toExcerpt(data.body),
  }));
}

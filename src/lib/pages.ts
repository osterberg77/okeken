import { getCollection } from 'astro:content';
import { renderMarkdown, toExcerpt } from './markdown';
import type { PublicPage } from '../types/page';

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

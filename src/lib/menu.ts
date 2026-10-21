// Bara i bygget: den publicerade menyn med sidorna uppslagna (beslut 0008).
import { getCollection, getEntry } from 'astro:content';
import { describeMenuWarning, resolveMenu } from './menu-resolve';
import type { PublicMenuItem } from '../types/menu';

// Header renderas på varje sida; varna bara en gång per bygge
const warned = new Set<string>();

/**
 * Toppnivåposterna i huvudmenyn, utan Kalendern (som Header lägger först). Tom lista om menyn aldrig
 * publicerats eller inte innehåller några publicerade sidor; då visar Header platshållarna.
 */
export async function getMenu(): Promise<PublicMenuItem[]> {
  const entry = await getEntry('menu', 'main');
  if (!entry) return [];
  const pages = (await getCollection('pages')).map(({ data }) => ({ pageId: data.pageId, slug: data.slug, title: data.title }));
  const { items, warnings } = resolveMenu(entry.data.items, pages);
  for (const w of warnings) {
    const text = describeMenuWarning(w);
    if (!warned.has(text)) {
      warned.add(text);
      console.warn(`Menyn: ${text}`);
    }
  }
  return items;
}

// Ren funktion utan Firebase/Astro-beroenden: används av bygget (src/lib/menu.ts) och kan användas av
// adminvyn för förhandsvisning och varningar med samma logik (beslut 0008).
import type { MenuItem, MenuPageRef, PublicMenuItem } from '../types/menu';

export type MenuWarning =
  /** Sidan finns inte eller är inte publicerad: posten/länken utelämnas */
  | { problem: 'unpublished'; pageId: string; label: string | null }
  /** Sidan förekommer redan tidigare i menyn: bara första förekomsten visas */
  | { problem: 'duplicate'; pageId: string; label: string | null }
  /** Rubrik utan egen sida och utan synliga undersidor: visas inte */
  | { problem: 'empty'; pageId: null; label: string };

export interface ResolvedMenu {
  items: PublicMenuItem[];
  warnings: MenuWarning[];
}

/**
 * Slår upp menyns sid-id:n mot publicerade sidor. Sidor som inte är publicerade utelämnas, en sida som
 * förekommer flera gånger visas bara första gången (i menyordning: postens egen sida före dess barn), och en
 * post utan länk och utan barn visas inte. Har en post en opublicerad egen sida men publicerade barn visas den
 * som rubrik.
 */
export function resolveMenu(items: MenuItem[], pages: MenuPageRef[]): ResolvedMenu {
  const byId = new Map(pages.map((p) => [p.pageId, p]));
  const seen = new Set<string>();
  const warnings: MenuWarning[] = [];

  const lookup = (pageId: string, label: string | null) => {
    if (seen.has(pageId)) {
      warnings.push({ problem: 'duplicate', pageId, label });
      return null;
    }
    seen.add(pageId);
    const page = byId.get(pageId);
    if (!page) warnings.push({ problem: 'unpublished', pageId, label });
    return page ?? null;
  };

  const result = items.flatMap((item): PublicMenuItem[] => {
    const own = item.pageId ? lookup(item.pageId, item.label) : null;
    const children = item.children.flatMap((id) => {
      const page = lookup(id, null);
      return page ? [{ label: page.title, href: `/${page.slug}` }] : [];
    });
    const href = own ? `/${own.slug}` : null;
    if (!href && children.length === 0) {
      if (!item.pageId) warnings.push({ problem: 'empty', pageId: null, label: item.label });
      return [];
    }
    return [{ label: item.label, href, children }];
  });

  return { items: result, warnings };
}

/** Varningen som läsbar svensk text (byggloggen och adminvyn) */
export function describeMenuWarning(w: MenuWarning): string {
  switch (w.problem) {
    case 'unpublished':
      return w.label
        ? `Menyposten "${w.label}" pekar på en sida (${w.pageId}) som inte är publicerad och länkar inte dit.`
        : `Undersidan ${w.pageId} är inte publicerad och visas inte i menyn.`;
    case 'duplicate':
      return w.label
        ? `Menyposten "${w.label}" pekar på en sida (${w.pageId}) som redan finns tidigare i menyn och länkar inte dit.`
        : `Undersidan ${w.pageId} finns redan tidigare i menyn och visas bara där.`;
    case 'empty':
      return `Rubriken "${w.label}" har inga publicerade undersidor och visas inte.`;
  }
}

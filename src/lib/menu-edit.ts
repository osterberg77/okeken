// Rena redigeringsfunktioner för menyutkastet (adminvyn /admin/meny, beslut 0008). Inget Firebase-beroende.
// Alla funktioner returnerar en ny lista och lämnar indata orörd. Gränserna kontrolleras av UI:t (och reglerna).
import { MAX_MENU_CHILDREN, MAX_MENU_ITEMS, MAX_MENU_LABEL, type MenuItem } from '../types/menu';

/** Alla sid-id:n som används i menyn (poster och undersidor) */
export function menuPageIds(items: MenuItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.pageId) ids.add(item.pageId);
    for (const c of item.children) ids.add(c);
  }
  return ids;
}

export const canAddTop = (items: MenuItem[]) => items.length < MAX_MENU_ITEMS;
export const canAddChild = (items: MenuItem[], parent: number) => (items[parent]?.children.length ?? MAX_MENU_CHILDREN) < MAX_MENU_CHILDREN;

/** Menytext av en sidtitel: högst 40 tecken */
export const labelFromTitle = (title: string) => title.trim().slice(0, MAX_MENU_LABEL) || 'Sida';

function swap<T>(list: T[], a: number, b: number): T[] {
  if (a < 0 || b < 0 || a >= list.length || b >= list.length) return list;
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function moveTop(items: MenuItem[], index: number, dir: -1 | 1): MenuItem[] {
  return swap(items, index, index + dir);
}

export function moveChild(items: MenuItem[], parent: number, child: number, dir: -1 | 1): MenuItem[] {
  return items.map((it, i) => (i === parent ? { ...it, children: swap(it.children, child, child + dir) } : it));
}

export function removeTop(items: MenuItem[], index: number): MenuItem[] {
  return items.filter((_, i) => i !== index);
}

export function removeChild(items: MenuItem[], parent: number, child: number): MenuItem[] {
  return items.map((it, i) => (i === parent ? { ...it, children: it.children.filter((_, c) => c !== child) } : it));
}

export function renameTop(items: MenuItem[], index: number, label: string): MenuItem[] {
  return items.map((it, i) => (i === index ? { ...it, label } : it));
}

export function addTopPage(items: MenuItem[], pageId: string, label: string): MenuItem[] {
  return canAddTop(items) ? [...items, { label: labelFromTitle(label), pageId, children: [] }] : items;
}

export function addHeading(items: MenuItem[], label: string): MenuItem[] {
  return canAddTop(items) ? [...items, { label: label.trim().slice(0, MAX_MENU_LABEL), pageId: null, children: [] }] : items;
}

export function addChild(items: MenuItem[], parent: number, pageId: string): MenuItem[] {
  return canAddChild(items, parent)
    ? items.map((it, i) => (i === parent ? { ...it, children: [...it.children, pageId] } : it))
    : items;
}

/** Kan posten flyttas in under en annan? Bara sidposter utan egna undersidor (annars blir det en tredje nivå) */
export const canNest = (item: MenuItem) => item.pageId !== null && item.children.length === 0;

/** Toppnivåpost -> undersida under en annan post */
export function nestTop(items: MenuItem[], from: number, to: number): MenuItem[] {
  const item = items[from];
  if (!item || !canNest(item) || from === to || !canAddChild(items, to)) return items;
  const without = removeTop(items, from);
  return addChild(without, to > from ? to - 1 : to, item.pageId!);
}

/** Undersida -> egen post direkt efter sin förälder */
export function unnestChild(items: MenuItem[], parent: number, child: number, label: string): MenuItem[] {
  const pageId = items[parent]?.children[child];
  if (!pageId || !canAddTop(items)) return items;
  const without = removeChild(items, parent, child);
  without.splice(parent + 1, 0, { label: labelFromTitle(label), pageId, children: [] });
  return without;
}

/** Undersida -> flyttas till en annan post */
export function moveChildTo(items: MenuItem[], parent: number, child: number, to: number): MenuItem[] {
  const pageId = items[parent]?.children[child];
  if (!pageId || parent === to || !canAddChild(items, to)) return items;
  return addChild(removeChild(items, parent, child), to, pageId);
}

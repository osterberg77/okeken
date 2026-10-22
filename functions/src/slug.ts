// Kopia av slugify/eventSlug i src/lib/slug.ts (funktionerna har egen rootDir). Håll dem synkade.
export function slugify(text: string, max = 80): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

export function eventSlug(startDay: string, title: string): string {
  const base = slugify(title);
  return base ? `${startDay}-${base}` : startDay;
}

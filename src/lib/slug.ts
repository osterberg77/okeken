/** 'Tisdagsträning vecka 39' → 'tisdagstraning-vecka-39' */
export function slugify(text: string, max = 80): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // å ä ö é → a a o e
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

/** Stabil eventadress: '<datum>-<titel>', t.ex. '2026-09-22-tisdagstraning-vecka-39' */
export function eventSlug(startDay: string, title: string): string {
  const base = slugify(title);
  return base ? `${startDay}-${base}` : startDay;
}

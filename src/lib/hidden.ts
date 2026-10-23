// "Dölj mig" (beslut 0018): personer som valt att inte synas utelämnas helt ur allt som visas publikt eller för medlemmar.
// Ingen Firebase-import: används i bygget (src/lib/server/published-events.ts) och testas fristående.

export interface HiddenPeople {
  /** uid för användare med users.hidden == true */
  uids: Set<string>;
  /** Visningsnamn (normaliserade med normalizeName) för samma personer, för rader som skrivits in som fritext utan medlemslänk */
  names: Set<string>;
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv');
}

/**
 * Tar bort dolda personer ur en lista med namn och valfri medlemslänk. En rad utelämnas om dess `memberUid` är dold, eller
 * (när länk saknas) om namnet är exakt samma som en dold persons visningsnamn. Det senare fångar banläggare som skrivit in
 * namnet som fritext; en annan person med samma namn kan i sällsynta fall utelämnas av misstag, vilket är det säkra felet.
 */
export function omitHidden<T extends { name: string; memberUid?: string | null }>(entries: T[], hidden: HiddenPeople): T[] {
  return entries.filter((e) => {
    if (e.memberUid) return !hidden.uids.has(e.memberUid);
    return !hidden.names.has(normalizeName(e.name));
  });
}

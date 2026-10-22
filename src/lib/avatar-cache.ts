// Ingen Firebase-import här: headern läser den innan Firebase hunnit laddas.

const KEY = 'okeken:avatar';

/** Senast kända utseende på kontoknappen, så att den kan ritas direkt vid sidbyte (innan Firebase svarat). */
export interface CachedAvatar {
  initial: string;
  color?: string;
  photoUrl?: string;
}

export function readCachedAvatar(): CachedAvatar | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CachedAvatar>;
    if (typeof v.initial !== 'string') return null;
    return {
      initial: v.initial.slice(0, 1),
      color: typeof v.color === 'string' ? v.color : undefined,
      photoUrl: typeof v.photoUrl === 'string' && v.photoUrl.startsWith('https://') ? v.photoUrl : undefined,
    };
  } catch {
    return null;
  }
}

export function writeCachedAvatar(avatar: CachedAvatar | null): void {
  try {
    if (avatar) localStorage.setItem(KEY, JSON.stringify(avatar));
    else localStorage.removeItem(KEY);
  } catch {
    // Privat läge e.d.: knappen ritas då först när sessionen laddats
  }
}

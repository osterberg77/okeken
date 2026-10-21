// Ingen Firebase-import här: används av bygget, kalendern och adminpreview.
import type { PublicEvent } from '../types/event';
import { isBankImageUrl } from './markdown';

/** Huvudbilden i publik form, eller undefined. Adresser utanför bildbanken släpps inte igenom (reglerna nekar dem redan). */
export function toPublicImage(image: unknown): PublicEvent['image'] {
  if (!image || typeof image !== 'object') return undefined;
  const { url, alt } = image as { url?: unknown; alt?: unknown };
  if (typeof url !== 'string' || !isBankImageUrl(url)) return undefined;
  return { url, alt: typeof alt === 'string' ? alt.trim() : '' };
}

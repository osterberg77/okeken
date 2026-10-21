/**
 * Bildbanken (beslut 0007). En post i `imageBank/{imageId}` per bild, med tre filer i Storage:
 * `image_bank/<imageId>-<original|web|thumbnail>.<jpg|png|webp>`. Reglerna (firestore.rules, storage.rules)
 * binder sökvägar och URL:er till postens id, så filerna laddas upp med det id som posten sedan skapas med.
 */

/** Bildtyper som får laddas upp. SVG, GIF m.fl. nekas av reglerna */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** Filändelse per typ, måste stämma med contentType vid uppladdning (storage.rules) */
export const IMAGE_EXTENSIONS: Record<ImageType, ImageExtension> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
export type ImageExtension = 'jpg' | 'png' | 'webp';

export type ImageVariant = 'original' | 'web' | 'thumbnail';

export const IMAGE_BANK_DIR = 'image_bank';

/** Storage-sökväg för en variant. imageId är Firestore-id (bara A–Z, a–z, 0–9, högst 64 tecken) */
export function imageStoragePath(imageId: string, variant: ImageVariant, ext: ImageExtension): string {
  return `${IMAGE_BANK_DIR}/${imageId}-${variant}.${ext}`;
}

export const MAX_IMAGE_NAME = 200;
export const MAX_IMAGE_BYLINE = 200;
export const MAX_IMAGE_DESCRIPTION = 300;

/** Största fil som går att välja (fältet `size`) */
export const MAX_IMAGE_SOURCE_BYTES = 30 * 1024 * 1024;
/** Största fil per variant i Storage. Större original skalas ner till ORIGINAL_MAX_EDGE före uppladdning */
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;

/** Längsta sida i pixlar */
export const ORIGINAL_MAX_EDGE = 3840;
export const WEB_MAX_EDGE = 1920;
export const THUMBNAIL_MAX_EDGE = 800;

/** Kvalitet för JPEG/WebP vid skalning i webbläsaren (canvas.toBlob) */
export const ORIGINAL_QUALITY = 0.9;
export const WEB_QUALITY = 0.85;
export const THUMBNAIL_QUALITY = 0.8;

/** Det som får ändras efter uppladdning. Alla fält finns alltid; tom sträng = saknas */
export interface ImageBankMeta {
  /** Visningsnamn, 1–200 tecken (förifylls med filnamnet) */
  name: string;
  /** Fotograf, högst 200 tecken */
  byline: string;
  /** Alt-text, högst 300 tecken */
  description: string;
}

export interface ImageBankStoragePaths {
  original: string;
  web: string;
  thumbnail: string;
}

/** Det som editorn skriver vid skapande (plus `uploadedBy` och `createdAt` = servertid) */
export interface ImageBankDraft extends ImageBankMeta {
  /** Nedladdnings-URL:er (getDownloadURL) till filerna i storagePaths, i bucketen okeken.firebasestorage.app */
  url: string;
  /** Längsta sida högst WEB_MAX_EDGE; det som infogas i Markdown */
  webUrl: string;
  /** Längsta sida högst THUMBNAIL_MAX_EDGE; för listor och bildväljaren */
  thumbnailUrl: string;
  storagePaths: ImageBankStoragePaths;
  /** Den valda filens storlek i byte (0–30 MB); den lagrade originalfilen kan vara nedskalad */
  size: number;
  /** Den valda filens typ */
  type: ImageType;
}

export interface ImageBankItem extends ImageBankDraft {
  id: string;
  uploadedBy: string;
  createdAt: Date | null;
}

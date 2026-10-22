import {
  IMAGE_TYPES,
  MAX_IMAGE_FILE_BYTES,
  MAX_IMAGE_SOURCE_BYTES,
  ORIGINAL_MAX_EDGE,
  ORIGINAL_QUALITY,
  THUMBNAIL_MAX_EDGE,
  THUMBNAIL_QUALITY,
  WEB_MAX_EDGE,
  WEB_QUALITY,
  type ImageType,
} from '../types/image';

/** Klartext på svenska för filer som inte kan laddas upp */
export class ImageRejected extends Error {}

/** Filens typ, med ändelsen som reserv (vissa webbläsare ger tom type). Kastar ImageRejected med förklaring. */
export function detectImageType(file: File): ImageType {
  const name = file.name.toLowerCase();
  if (/image\/hei[cf]/.test(file.type) || /\.hei[cf]$/.test(name)) {
    throw new ImageRejected('HEIC/HEIF stöds inte. Exportera bilden som JPEG (på iPhone: Inställningar > Kamera > Format > Mest kompatibel) och försök igen.');
  }
  let type = file.type;
  if (!type) {
    if (/\.jpe?g$/.test(name)) type = 'image/jpeg';
    else if (name.endsWith('.png')) type = 'image/png';
    else if (name.endsWith('.webp')) type = 'image/webp';
  }
  if (!(IMAGE_TYPES as readonly string[]).includes(type)) {
    throw new ImageRejected('Bara JPEG-, PNG- och WebP-bilder kan laddas upp.');
  }
  if (file.size > MAX_IMAGE_SOURCE_BYTES) {
    throw new ImageRejected(`Bilden är större än ${MAX_IMAGE_SOURCE_BYTES / 1024 / 1024} MB. Minska den först.`);
  }
  return type as ImageType;
}

function toBlob(canvas: HTMLCanvasElement, type: ImageType, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Kunde inte skala bilden.'))), type, quality),
  );
}

/**
 * Skalar så att längsta sidan blir högst maxEdge (förstorar aldrig). Samma typ som källan, så ändelsen stämmer
 * med contentType. Blir resultatet över 10 MB (stora PNG) skalas det ner stegvis tills det går.
 */
export async function scaleImage(bitmap: ImageBitmap, type: ImageType, maxEdge: number, quality: number): Promise<Blob> {
  let scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Webbläsaren saknar stöd för att skala bilder.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await toBlob(canvas, type, quality);
    // Webbläsare som inte kan koda typen (t.ex. äldre Safari för webp) ger png: då stämmer inte ändelsen
    if (blob.type !== type) throw new ImageRejected('Webbläsaren kan inte skala den här bildtypen. Prova en JPEG-bild.');
    if (blob.size <= MAX_IMAGE_FILE_BYTES) return blob;
    scale *= 0.75;
  }
  throw new ImageRejected('Bilden går inte att göra tillräckligt liten. Minska den först.');
}

export interface PreparedImage {
  type: ImageType;
  /** Valda filens storlek (fältet size) */
  size: number;
  original: Blob;
  web: Blob;
  thumbnail: Blob;
}

/** Läser filen och skapar de tre varianterna (original, web 1920 px, miniatyr 800 px) */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const type = detectImageType(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageRejected('Filen går inte att läsa som en bild.');
  }
  try {
    const original =
      file.size <= MAX_IMAGE_FILE_BYTES
        ? file.slice(0, file.size, type)
        : await scaleImage(bitmap, type, ORIGINAL_MAX_EDGE, ORIGINAL_QUALITY);
    const web = await scaleImage(bitmap, type, WEB_MAX_EDGE, WEB_QUALITY);
    const thumbnail = await scaleImage(bitmap, type, THUMBNAIL_MAX_EDGE, THUMBNAIL_QUALITY);
    return { type, size: file.size, original, web, thumbnail };
  } finally {
    bitmap.close();
  }
}

export const AVATAR_EDGE = 256;
export const AVATAR_QUALITY = 0.85;

/** Profilbild: beskär mitten till en kvadrat, 256 px, alltid JPEG (vit botten för genomskinliga PNG). */
export async function prepareAvatar(file: File): Promise<Blob> {
  detectImageType(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageRejected('Filen går inte att läsa som en bild.');
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = AVATAR_EDGE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Webbläsaren saknar stöd för att skala bilder.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, AVATAR_EDGE, AVATAR_EDGE);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_EDGE, AVATAR_EDGE);
    return await toBlob(canvas, 'image/jpeg', AVATAR_QUALITY);
  } finally {
    bitmap.close();
  }
}

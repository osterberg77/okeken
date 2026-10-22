/** Startpunkten för avstånd och rutt: rondellen mitt i Åtvidaberg. */
export const HOME = { lat: 58.2025, lng: 16.001472, name: 'Åtvidaberg' } as const;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Rutt (bil) från HOME, beräknad vid bygget. `points` är [lng, lat] med få punkter. */
export interface EventRoute {
  km: number;
  minutes: number;
  points: [number, number][];
}

const validLatLng = (lat: number, lng: number): LatLng | null =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;

/**
 * Läser koordinater ur text: "58.2025, 16.0015", "58.2025 16.0015" eller en lång Google Maps-/OSM-länk
 * (…@58.2,16.0… eller …!3d58.2!4d16.0…). Tom eller obegriplig text ger null.
 */
export function parseCoords(text: string): LatLng | null {
  const t = text.trim();
  if (!t) return null;
  const maps = t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ?? t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const plain = t.match(/^(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)$/);
  const m = maps ?? plain;
  return m ? validLatLng(Number(m[1].replace(',', '.')), Number(m[2].replace(',', '.'))) : null;
}

/** Avstånd fågelvägen i km */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Öppnar platsen i Google Maps (appen på mobil, annars webben) */
export const googleMapsUrl = (at: LatLng): string => `https://www.google.com/maps/search/?api=1&query=${at.lat},${at.lng}`;

/** Koordinater som text i samma format som admin tar emot: "58.20250, 16.00147" */
export const formatCoords = (at: LatLng): string => `${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}`;

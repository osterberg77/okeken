// Orienteringskartor (beslut 0025): maps/{mapId}. `current` och `job` skrivs bara av konverteringen (Admin SDK).

export type MapJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface OMapVersion {
  version: string;
  /** [syd, väst, nord, öst] i WGS84 */
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  scale: number;
  sourceName: string;
  builtAt: Date | null;
}

export interface OMap {
  id: string;
  name: string;
  current: OMapVersion | null;
  job: {
    status: MapJobStatus;
    sourceName: string;
    queuedAt: Date | null;
    finishedAt: Date | null;
    error?: string;
  } | null;
}

export const MAP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_MAP_NAME = 80;
export const MAX_MAP_FILE_BYTES = 100 * 1024 * 1024;
export const MAP_FILE_EXTENSIONS = ['omap', 'ocd'] as const;

/** Kart-id från namnet: gemener, a–z/0–9/bindestreck (å/ä → a, ö → o). */
export function mapIdFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Leaflet-mall för kartans tiles. `host` byts mot emulatorn lokalt. */
export function mapTileUrl(bucket: string, mapId: string, version: string, host = 'https://firebasestorage.googleapis.com'): string {
  return `${host}/v0/b/${bucket}/o/map_tiles%2F${mapId}%2F${version}%2F{z}%2F{x}%2F{y}.png?alt=media`;
}

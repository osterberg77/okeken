/** Ikoner för platser på eventkartan (huvudplatsen och extra platser). Delas av bygget, förhandsvisningen och admin. */
export const PLACE_ICONS = ['start', 'parking', 'toilet', 'finish', 'gathering', 'water', 'firstaid', 'mailbox', 'other'] as const;
export type PlaceIcon = (typeof PLACE_ICONS)[number];

export const DEFAULT_PLACE_ICON: PlaceIcon = 'start';
export const MAX_EXTRA_PLACES = 3;
export const MAX_PLACE_LABEL = 100;

export const PLACE_ICON_LABELS: Record<PlaceIcon, string> = {
  start: 'Start',
  parking: 'Parkering',
  toilet: 'Toalett',
  finish: 'Mål',
  gathering: 'Samling',
  water: 'Vatten',
  firstaid: 'Första hjälpen',
  mailbox: 'Brevlåda',
  other: 'Övrigt',
};

/** Kort tecken som ritas i kartmarkören (start ritas som triangel och har ingen text) */
export const PLACE_ICON_GLYPHS: Record<PlaceIcon, string> = {
  start: '▲',
  parking: 'P',
  toilet: 'WC',
  finish: '◎',
  gathering: '⚑',
  water: '💧',
  firstaid: '✚',
  mailbox: '✉',
  other: '•',
};

export const isPlaceIcon = (v: unknown): v is PlaceIcon => typeof v === 'string' && (PLACE_ICONS as readonly string[]).includes(v);

/** Extra plats på eventkartan, i publik form */
export interface ExtraPlace {
  icon: PlaceIcon;
  /** Valfri text, t.ex. "Parkering 2". Tom = ikonens namn */
  label: string;
  lat: number;
  lng: number;
}

/** Sanerar platser från Firestore: okända ikoner blir "other", platser utan giltiga koordinater hoppas över */
export function toExtraPlaces(raw: unknown): ExtraPlace[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p): ExtraPlace[] => {
    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return [];
    return [{ icon: isPlaceIcon(p.icon) ? p.icon : 'other', label: typeof p.label === 'string' ? p.label : '', lat: p.lat, lng: p.lng }];
  });
}

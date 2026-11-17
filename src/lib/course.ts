// Bangeometri för enkel banläggning (beslut 0026). Används både av kartvisaren (i meter) och av utskriften (i mm).
// Mått enligt ISOM: kontrollring 5 mm, start-triangel 6 mm sida, mål två ringar 5 och 7 mm, linjer 0,35 mm.
import { MAX_COURSE_POINTS, type CoursePoint } from '../types/map';

export const MAX_POINTS = MAX_COURSE_POINTS;

export const COURSE_COLOR = '#B62FB5';
export const MM = {
  control: 2.5,
  startSide: 6,
  finishInner: 2.5,
  finishOuter: 3.5,
  line: 0.35,
  number: 4,
} as const;

const EARTH_RADIUS = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Avstånd i meter (storcirkel). */
export function distance(a: CoursePoint, b: CoursePoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

/** Banlängd i meter, fågelvägen mellan punkterna i ordning. */
export function courseLength(points: CoursePoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += distance(points[i - 1], points[i]);
  return sum;
}

/** "850 m" eller "4,3 km". */
export function formatLength(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

export const formatScale = (scale: number) => `1:${scale.toLocaleString('sv-SE')}`;

export interface XY {
  x: number;
  y: number;
}

export interface CourseShapes {
  /** Linjer mellan symbolerna, kapade vid ringarna */
  legs: [XY, XY][];
  start: XY[] | null;
  controls: { at: XY; n: number; label: XY }[];
  finish: XY | null;
}

/**
 * Banans symboler i ett plant koordinatsystem. `unit` = enheter per mm på papperet, `north` = +1 om y växer norrut
 * (meter) och −1 om y växer nedåt (papper). Första punkten är start, sista är mål (om det finns minst två).
 */
export function courseShapes(pts: XY[], unit: number, north: 1 | -1): CourseShapes {
  const radiusOf = (i: number) =>
    unit * (i === 0 ? MM.startSide / Math.sqrt(3) : i === pts.length - 1 ? MM.finishOuter : MM.control);
  const legs: [XY, XY][] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ra = radiusOf(i - 1) + unit * 0.4;
    const rb = radiusOf(i) + unit * 0.4;
    if (len <= ra + rb) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    legs.push([
      { x: a.x + ux * ra, y: a.y + uy * ra },
      { x: b.x - ux * rb, y: b.y - uy * rb },
    ]);
  }

  let start: XY[] | null = null;
  if (pts.length > 0) {
    // Triangeln pekar mot första kontrollen (eller norrut om det inte finns någon)
    const s = pts[0];
    const next = pts[1];
    let angle = Math.atan2(north, 0);
    if (next && (next.x !== s.x || next.y !== s.y)) angle = Math.atan2(next.y - s.y, next.x - s.x);
    const r = unit * (MM.startSide / Math.sqrt(3));
    start = [0, 1, 2].map((k) => ({ x: s.x + r * Math.cos(angle + (k * 2 * Math.PI) / 3), y: s.y + r * Math.sin(angle + (k * 2 * Math.PI) / 3) }));
  }

  const off = unit * (MM.control + MM.number * 0.55);
  const controls = pts.slice(1, pts.length >= 2 ? -1 : undefined).map((at, i) => ({
    at,
    n: i + 1,
    label: { x: at.x + off * 0.75, y: at.y + north * off * 0.75 },
  }));

  return { legs, start, controls, finish: pts.length >= 2 ? pts[pts.length - 1] : null };
}

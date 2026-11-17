// Utskrift av ett kartutsnitt på A4 i vald skala (beslut 0026). Sidan byggs av kartans egna tiles som <img> placerade
// i millimeter, med banan som SVG ovanpå, och skrivs ut med webbläsarens utskriftsdialog. Inga extra anrop utöver
// de rutor som täcker utsnittet, och upplösningen väljs så låg som ger ca 180 dpi.
import L from 'leaflet';
import type { CoursePoint } from '../types/map';
import { COURSE_COLOR, courseShapes, MM, type XY } from './course';

export type Orientation = 'portrait' | 'landscape';

/** Utskriftsytan inom sidmarginalen på 10 mm (med 1 mm marginal mot sidbrytning). */
export function paperSize(orientation: Orientation): { w: number; h: number } {
  return orientation === 'portrait' ? { w: 190, h: 276 } : { w: 277, h: 189 };
}

const TILE = 256;
const MIN_PX_PER_MM = 7; // ca 180 dpi
const crs = L.CRS.EPSG3857;
const metersPerPixel = (lat: number, z: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

/** Utsnittets hörn för en sida med mitten i `center`, för ramen på skärmen. */
export function printFrame(center: L.LatLng, scale: number, orientation: Orientation): L.LatLngBounds {
  const { w, h } = paperSize(orientation);
  const z = 20;
  const mmPerPx = (metersPerPixel(center.lat, z) * 1000) / scale;
  const c = crs.latLngToPoint(center, z);
  const half = L.point(w / mmPerPx / 2, h / mmPerPx / 2);
  return L.latLngBounds(crs.pointToLatLng(c.subtract(half), z), crs.pointToLatLng(c.add(half), z));
}

export interface PrintJob {
  /** Leaflet-mall för kartans tiles */
  url: string;
  /** [syd, väst, nord, öst] */
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  center: L.LatLng;
  scale: number;
  orientation: Orientation;
  points: CoursePoint[];
  /** Texten i nedre högra hörnet (banlängd och skala) */
  caption: string[];
  /** Bilden i nedre vänstra hörnet */
  logo: string;
}

const ROOT_ID = 'okeken-map-print';

function cleanup() {
  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(`${ROOT_ID}-style`)?.remove();
}

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Bygger sidan, väntar in rutorna och öppnar utskriftsdialogen. `onProgress` får andelen hämtade rutor. */
export async function printMap(job: PrintJob, onProgress: (fraction: number) => void): Promise<void> {
  cleanup();
  const { w, h } = paperSize(job.orientation);
  const lat = job.center.lat;
  let z = job.maxZoom;
  for (let candidate = job.minZoom; candidate <= job.maxZoom; candidate++) {
    if ((job.scale / 1000 / metersPerPixel(lat, candidate)) >= MIN_PX_PER_MM) {
      z = candidate;
      break;
    }
  }
  const mmPerPx = (metersPerPixel(lat, z) * 1000) / job.scale;
  const c = crs.latLngToPoint(job.center, z);
  const topLeft = c.subtract(L.point(w / mmPerPx / 2, h / mmPerPx / 2));
  const bottomRight = c.add(L.point(w / mmPerPx / 2, h / mmPerPx / 2));
  const toMm = (p: L.Point): XY => ({ x: (p.x - topLeft.x) * mmPerPx, y: (p.y - topLeft.y) * mmPerPx });

  // Bara rutor som både täcker sidan och ligger inom kartan
  const [s, west, n, e] = job.bounds;
  const mapNW = crs.latLngToPoint(L.latLng(n, west), z);
  const mapSE = crs.latLngToPoint(L.latLng(s, e), z);
  const x0 = Math.floor(Math.max(topLeft.x, mapNW.x) / TILE);
  const x1 = Math.floor((Math.min(bottomRight.x, mapSE.x) - 1e-6) / TILE);
  const y0 = Math.floor(Math.max(topLeft.y, mapNW.y) / TILE);
  const y1 = Math.floor((Math.min(bottomRight.y, mapSE.y) - 1e-6) / TILE);

  const style = document.createElement('style');
  style.id = `${ROOT_ID}-style`;
  style.textContent = `
    @page { size: A4 ${job.orientation}; margin: 10mm; }
    #${ROOT_ID} { position: fixed; left: -10000px; top: 0; }
    #${ROOT_ID} .sheet { position: relative; width: ${w}mm; height: ${h}mm; overflow: hidden; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; break-inside: avoid; }
    #${ROOT_ID} .tile { position: absolute; display: block; max-width: none; image-rendering: auto; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; min-height: 0 !important; }
      body > *:not(#${ROOT_ID}) { display: none !important; }
      #${ROOT_ID} { position: static; }
    }`;
  document.head.append(style);

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  root.append(sheet);

  const loads: Promise<void>[] = [];
  const total = Math.max(0, (x1 - x0 + 1) * (y1 - y0 + 1));
  let done = 0;
  const size = TILE * mmPerPx + 0.06; // lite överlapp så att inga hårstreck syns mellan rutorna
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const img = document.createElement('img');
      img.className = 'tile';
      img.alt = '';
      const at = toMm(L.point(x * TILE, y * TILE));
      Object.assign(img.style, { left: `${at.x}mm`, top: `${at.y}mm`, width: `${size}mm`, height: `${size}mm` });
      loads.push(
        new Promise<void>((resolve) => {
          const finish = () => {
            onProgress(++done / total);
            resolve();
          };
          img.onload = finish;
          img.onerror = () => {
            img.remove(); // tomma rutor finns inte, då syns vit bakgrund
            finish();
          };
        }),
      );
      img.src = job.url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
      sheet.append(img);
    }
  }

  // Banan
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: `${w}mm`, height: `${h}mm` });
  svg.setAttribute('style', 'position:absolute;left:0;top:0');
  const shapes = courseShapes(job.points.map((p) => toMm(crs.latLngToPoint(L.latLng(p.lat, p.lng), z))), 1, -1);
  const stroke = { fill: 'none', stroke: COURSE_COLOR, 'stroke-width': MM.line };
  for (const [a, b] of shapes.legs) svg.append(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...stroke }));
  if (shapes.start) svg.append(svgEl('polygon', { points: shapes.start.map((p) => `${p.x},${p.y}`).join(' '), ...stroke, 'stroke-linejoin': 'round' }));
  for (const c of shapes.controls) {
    svg.append(svgEl('circle', { cx: c.at.x, cy: c.at.y, r: MM.control, ...stroke }));
    const t = svgEl('text', {
      x: c.label.x, y: c.label.y, fill: COURSE_COLOR, 'font-size': MM.number, 'font-family': 'Arial, Helvetica, sans-serif',
      'text-anchor': 'middle', 'dominant-baseline': 'central', stroke: '#fff', 'stroke-width': 0.5, 'paint-order': 'stroke',
    });
    t.textContent = String(c.n);
    svg.append(t);
  }
  if (shapes.finish) {
    svg.append(svgEl('circle', { cx: shapes.finish.x, cy: shapes.finish.y, r: MM.finishInner, ...stroke }));
    svg.append(svgEl('circle', { cx: shapes.finish.x, cy: shapes.finish.y, r: MM.finishOuter, ...stroke }));
  }
  sheet.append(svg);

  const logo = document.createElement('img');
  logo.src = job.logo;
  logo.alt = '';
  logo.setAttribute('style', 'position:absolute;left:0;bottom:0;width:72mm;height:auto;display:block;background:#fff');
  loads.push(new Promise((resolve) => ((logo.onload = () => resolve()), (logo.onerror = () => resolve()))));
  sheet.append(logo);

  const caption = document.createElement('div');
  caption.setAttribute(
    'style',
    'position:absolute;right:0;bottom:0;background:#fff;padding:1.5mm 2.5mm;font:600 11pt/1.35 Arial, Helvetica, sans-serif;color:#000;text-align:right',
  );
  for (const line of job.caption) {
    const div = document.createElement('div');
    div.textContent = line;
    caption.append(div);
  }
  sheet.append(caption);

  document.body.append(root);
  if (total === 0) onProgress(1);
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 30000))]);
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}

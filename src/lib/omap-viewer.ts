// Kartvisaren för orienteringskartor (beslut 0025). Laddas dynamiskt från MapsPage.
// OSM i botten (https://operations.osmfoundation.org/policies/tiles/, behåll attributionen), o-kartan ovanpå.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CoursePoint } from '../types/map';
import { COURSE_COLOR, courseShapes, MAX_POINTS, MM, type XY } from './course';
import { printFrame, type Orientation } from './map-print';

const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const ACCENT = '#8A4B9E';

export interface OMapLayer {
  url: string;
  /** [syd, väst, nord, öst] */
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
}

export interface OMapViewer {
  show(layer: OMapLayer, fit: boolean): void;
  setOpacity(opacity: number): void;
  /** Följ GPS-positionen; `onError` får ett meddelande på svenska. */
  locate(on: boolean, onError: (message: string) => void): void;
  /** Utskriftsram: startar i kartans mitt, ligger sedan kvar på sin plats och flyttas bara genom att dra i den. null tar bort den. */
  setPrintFrame(frame: { scale: number; orientation: Orientation } | null): void;
  center(): L.LatLng;
  /** Ritar banan i den storlek den får vid `scale` (som på utskriften). */
  setCourse(points: CoursePoint[], scale: number): void;
  /** Banläggning: klick lägger till en punkt, punkterna går att dra. `onChange` får hela den nya listan. */
  setEditing(on: boolean, onChange: (points: CoursePoint[]) => void): void;
  fitCourse(): void;
  destroy(): void;
}

export function mountOMapViewer(el: HTMLElement, opacity: number): OMapViewer {
  const map = L.map(el, { zoomControl: true, attributionControl: true, maxZoom: 19 });
  L.tileLayer(OSM, { maxZoom: 19, maxNativeZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
  let layer: L.TileLayer | null = null;
  let me: L.LayerGroup | null = null;
  let firstFix = true;

  const onFound = (e: L.LocationEvent) => {
    me?.remove();
    me = L.layerGroup([
      L.circle(e.latlng, { radius: e.accuracy, color: ACCENT, weight: 1, fillOpacity: 0.1 }),
      L.circleMarker(e.latlng, { radius: 8, color: '#FFFEF8', weight: 3, fillColor: ACCENT, fillOpacity: 1 }),
    ]).addTo(map);
    if (firstFix) map.setView(e.latlng, Math.max(map.getZoom(), 16));
    firstFix = false;
  };

  // ---- Utskriftsram ----
  let frame: { scale: number; orientation: Orientation } | null = null;
  let frameCenter: L.LatLng | null = null;
  const frameRect = L.rectangle([[0, 0], [0, 0]], { color: ACCENT, weight: 2, dashArray: '6 6', fill: true, fillOpacity: 0.04, interactive: true, className: 'print-frame' });
  const drawFrame = () => frame && frameCenter && frameRect.setBounds(printFrame(frameCenter, frame.scale, frame.orientation));
  // Dra ramen med mus eller finger; kartan panorerar inte under tiden
  frameRect.on('add', () => {
    const path = frameRect.getElement() as SVGElement | undefined;
    if (!path) return;
    path.style.cursor = 'move';
    path.style.touchAction = 'none';
    let grab: L.LatLng | null = null; // skillnad mellan greppunkt och ramens mitt
    path.addEventListener('pointerdown', (e) => {
      if (!frameCenter) return;
      const at = map.mouseEventToLatLng(e);
      grab = L.latLng(frameCenter.lat - at.lat, frameCenter.lng - at.lng);
      path.setPointerCapture(e.pointerId);
      map.dragging.disable();
      e.preventDefault();
      e.stopPropagation();
    });
    path.addEventListener('pointermove', (e) => {
      if (!grab) return;
      const at = map.mouseEventToLatLng(e);
      frameCenter = L.latLng(at.lat + grab.lat, at.lng + grab.lng);
      drawFrame();
    });
    const end = () => {
      if (!grab) return;
      grab = null;
      map.dragging.enable();
    };
    path.addEventListener('pointerup', end);
    path.addEventListener('pointercancel', end);
  });

  // ---- Bana ----
  let points: CoursePoint[] = [];
  let courseScale = 10000;
  let editing = false;
  let onCourseChange: (p: CoursePoint[]) => void = () => {};
  const course = L.layerGroup().addTo(map);
  const handles = L.layerGroup().addTo(map);

  function drawCourse() {
    course.clearLayers();
    if (points.length === 0) return;
    // Plant system i meter kring första punkten; storlekarna motsvarar mm på papperet vid courseScale
    const ref = points[0];
    const k = (Math.PI / 180) * 6371008.8;
    const cos = Math.cos((ref.lat * Math.PI) / 180);
    const toXY = (p: CoursePoint): XY => ({ x: (p.lng - ref.lng) * k * cos, y: (p.lat - ref.lat) * k });
    const toLL = (p: XY): L.LatLngTuple => [ref.lat + p.y / k, ref.lng + p.x / (k * cos)];
    const unit = courseScale / 1000;
    const shapes = courseShapes(points.map(toXY), unit, 1);
    // Linjebredd och siffror i samma skala som ringarna: mm på papperet → meter i terrängen → pixlar vid aktuell zoom
    const pxPerMm = unit / ((156543.03392 * Math.cos((map.getCenter().lat * Math.PI) / 180)) / 2 ** map.getZoom());
    const style = { color: COURSE_COLOR, weight: Math.max(0.5, MM.line * pxPerMm), fill: false, interactive: false };
    const fontPx = Math.max(7, MM.number * pxPerMm);
    for (const [a, b] of shapes.legs) L.polyline([toLL(a), toLL(b)], style).addTo(course);
    if (shapes.start) L.polygon(shapes.start.map(toLL), style).addTo(course);
    for (const c of shapes.controls) {
      L.circle(toLL(c.at), { ...style, radius: MM.control * unit }).addTo(course);
      L.marker(toLL(c.label), {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: '',
          iconSize: [fontPx * 2, fontPx],
          iconAnchor: [fontPx, fontPx / 2],
          html: `<span style="display:block;text-align:center;color:${COURSE_COLOR};font:${fontPx}px/${fontPx}px Arial,sans-serif;text-shadow:0 0 2px #fff,0 0 2px #fff">${c.n}</span>`,
        }),
      }).addTo(course);
    }
    if (shapes.finish) {
      L.circle(toLL(shapes.finish), { ...style, radius: MM.finishInner * unit }).addTo(course);
      L.circle(toLL(shapes.finish), { ...style, radius: MM.finishOuter * unit }).addTo(course);
    }
  }

  const handleIcon = L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<span style="display:block;width:30px;height:30px;border-radius:50%;cursor:move"></span>`,
  });

  function drawHandles() {
    handles.clearLayers();
    if (!editing) return;
    points.forEach((p, i) => {
      const name = i === 0 ? 'Start' : i === points.length - 1 && i > 0 ? 'Mål' : `Kontroll ${i}`;
      const m = L.marker([p.lat, p.lng], { draggable: true, icon: handleIcon, title: `${name} – klicka för att ta bort`, keyboard: false });
      m.on('drag', () => {
        const ll = m.getLatLng();
        points = points.map((q, j) => (j === i ? { lat: ll.lat, lng: ll.lng } : q));
        drawCourse();
      });
      m.on('dragend', () => onCourseChange(points));
      // Klick (inte drag) tar bort punkten; Leaflet skickar inget klick efter en dragning
      m.on('click', () => onCourseChange(points.filter((_, j) => j !== i)));
      m.addTo(handles);
    });
  }

  const onMapClick = (e: L.LeafletMouseEvent) => {
    if (!editing || points.length >= MAX_POINTS) return;
    const added = { lat: e.latlng.lat, lng: e.latlng.lng };
    const leg = legAt(e.containerPoint);
    // Klick på ett streck lägger in en kontroll mellan dess punkter, annars läggs punkten sist
    onCourseChange(leg === null ? [...points, added] : [...points.slice(0, leg), added, ...points.slice(leg)]);
  };

  /** Index för punkten som avslutar sträckan närmast `p` (inom ca ett fingertopp), eller null. */
  const LEG_HIT_PX = 12;
  function legAt(p: L.Point): number | null {
    let best: number | null = null;
    let bestDist = LEG_HIT_PX;
    for (let i = 1; i < points.length; i++) {
      const a = map.latLngToContainerPoint([points[i - 1].lat, points[i - 1].lng]);
      const b = map.latLngToContainerPoint([points[i].lat, points[i].lng]);
      const ab = b.subtract(a);
      const len2 = ab.x * ab.x + ab.y * ab.y;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len2));
      const d = p.distanceTo(L.point(a.x + t * ab.x, a.y + t * ab.y));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }
  map.on('click', onMapClick);
  map.on('zoomend', drawCourse);

  return {
    show(next, fit) {
      layer?.remove();
      const [s, w, n, e] = next.bounds;
      const bounds = L.latLngBounds([s, w], [n, e]);
      layer = L.tileLayer(next.url, {
        // Bara rutor inom kartan hämtas; över maxZoom förstoras den skarpaste nivån i stället för nya anrop
        bounds,
        minNativeZoom: next.minZoom,
        maxNativeZoom: next.maxZoom,
        minZoom: Math.max(0, next.minZoom - 3),
        maxZoom: 19,
        opacity,
        attribution: 'Karta © OK Eken',
      }).addTo(map);
      if (fit) map.fitBounds(bounds);
    },
    setOpacity(value) {
      opacity = value;
      layer?.setOpacity(value);
    },
    locate(on, onError) {
      map.off('locationfound', onFound);
      map.off('locationerror');
      map.stopLocate();
      me?.remove();
      me = null;
      if (!on) return;
      firstFix = true;
      map.on('locationfound', onFound);
      map.on('locationerror', (e: L.ErrorEvent) =>
        onError(e.code === 1 ? 'Du behöver tillåta platsåtkomst i webbläsaren.' : 'Kunde inte hitta din position.'));
      map.locate({ watch: true, enableHighAccuracy: true, setView: false });
    },
    setPrintFrame(next) {
      frame = next;
      if (!frame) {
        frameRect.remove();
        frameCenter = null;
        return;
      }
      frameCenter ??= map.getCenter();
      drawFrame();
      if (!map.hasLayer(frameRect)) frameRect.addTo(map);
      // Zooma ut om ramen inte får plats
      if (!map.getBounds().contains(frameRect.getBounds())) map.fitBounds(frameRect.getBounds(), { padding: [24, 24] });
    },
    center: () => frameCenter ?? map.getCenter(),
    setCourse(next, scale) {
      points = next;
      courseScale = scale;
      drawCourse();
      drawHandles();
    },
    setEditing(on, onChange) {
      editing = on;
      onCourseChange = onChange;
      map.getContainer().style.cursor = on ? 'crosshair' : '';
      drawHandles();
    },
    fitCourse() {
      if (points.length === 1) map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 15));
      else if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [48, 48] });
    },
    destroy() {
      map.stopLocate();
      map.remove();
    },
  };
}

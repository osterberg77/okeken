// Leaflet laddas bara dynamiskt (import('./leaflet-map')) och bara där en karta ska visas.
// Brickor från OpenStreetMap (https://operations.osmfoundation.org/policies/tiles/): behåll attributionen.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HOME, type LatLng } from './geo';
import { PLACE_ICON_GLYPHS, PLACE_ICON_LABELS, type ExtraPlace, type PlaceIcon } from './place-icons';

const ACCENT = '#8A4B9E';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

/**
 * `interactive`: adminkartan, där hela kartan ska gå att dra, nypa och scrolla-zooma direkt. På sajten ska en finger
 * i stället kunna skrolla sidan förbi kartan på mobil (nyp för att zooma).
 */
function baseMap(el: HTMLElement, interactive = false): L.Map {
  const map = L.map(el, {
    scrollWheelZoom: interactive,
    dragging: interactive || !L.Browser.mobile,
    touchZoom: true,
    attributionControl: true,
  });
  L.tileLayer(TILES, { maxZoom: 18, attribution: ATTRIBUTION }).addTo(map);
  return map;
}

const dot = (at: LatLng, color: string, radius: number) =>
  L.circleMarker([at.lat, at.lng], { radius, color: '#FFFEF8', weight: 3, fillColor: color, fillOpacity: 1 });

/** Rund markör med ikonens tecken; start ritas som triangel (som på orienteringskartan). `big` = huvudplatsen. */
function placeIcon(icon: PlaceIcon, big: boolean) {
  const size = big ? 34 : 26;
  const inner =
    icon === 'start'
      ? `<svg viewBox="-12 -12 24 24" width="${size - 8}" height="${size - 8}"><polygon points="0,-9 8,6 -8,6" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-linejoin="round"/></svg>`
      : `<span style="font:700 ${icon === 'toilet' ? 10 : 13}px/1 system-ui,sans-serif;color:${ACCENT}">${PLACE_ICON_GLYPHS[icon]}</span>`;
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:#FFFEF8;border:3px solid ${ACCENT};box-shadow:0 2px 6px rgba(0,0,0,.35)">${inner}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Visningskarta för en eventsida: huvudplatsen (med ikon), Åtvidaberg och rutten (eller bara platsen om den ligger nära),
 * samt extra platser. Returnerar en avregistrering.
 */
export function mountViewMap(el: HTMLElement, to: LatLng, route?: [number, number][], label?: string, icon: PlaceIcon = 'start', places: ExtraPlace[] = []): () => void {
  const map = baseMap(el);
  const bounds = L.latLngBounds([[to.lat, to.lng]]);
  if (route) {
    const line = route.map(([lng, lat]) => [lat, lng] as [number, number]);
    L.polyline(line, { color: ACCENT, weight: 4, opacity: 0.9 }).addTo(map);
    dot(HOME, '#2B2838', 6).bindTooltip(HOME.name, { permanent: true, direction: 'top' }).addTo(map);
    line.forEach((p) => bounds.extend(p));
  }
  const place = L.marker([to.lat, to.lng], { icon: placeIcon(icon, true), keyboard: false }).addTo(map);
  if (label) place.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -14] });
  for (const p of places) {
    L.marker([p.lat, p.lng], { icon: placeIcon(p.icon, false), keyboard: false })
      .bindTooltip(p.label || PLACE_ICON_LABELS[p.icon], { permanent: true, direction: 'top', offset: [0, -10] })
      .addTo(map);
    bounds.extend([p.lat, p.lng]);
  }
  if (route || places.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  else map.setView([to.lat, to.lng], 13);
  return () => map.remove();
}

export interface PickerItem {
  id: string;
  icon: PlaceIcon;
  at: LatLng | null;
  /** Platsen som nästa klick på kartan flyttar */
  active: boolean;
}

/**
 * Platsväljare för admin med alla platser på samma karta. Klick på kartan flyttar den aktiva platsen, markörerna går
 * att dra, och ett klick på en markör gör den aktiv.
 */
export function mountPickerMap(
  el: HTMLElement,
  items: PickerItem[],
  handlers: { onPlace: (id: string, at: LatLng) => void; onSelect: (id: string) => void },
) {
  const map = baseMap(el, true);
  const markers = new Map<string, L.Marker>();
  let activeId: string | null = null;
  const firstFit = (list: PickerItem[]) => {
    const pts = list.flatMap((i) => (i.at ? [[i.at.lat, i.at.lng] as [number, number]] : []));
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
    else if (pts.length === 1) map.setView(pts[0], 13);
    else map.setView([HOME.lat, HOME.lng], 9);
  };
  firstFit(items);

  const setItems = (list: PickerItem[]) => {
    const seen = new Set<string>();
    for (const item of list) {
      if (!item.at) continue;
      seen.add(item.id);
      const latlng: L.LatLngExpression = [item.at.lat, item.at.lng];
      const icon = placeIcon(item.icon, item.active);
      let m = markers.get(item.id);
      if (!m) {
        m = L.marker(latlng, { draggable: true, icon, keyboard: false }).addTo(map);
        const id = item.id;
        m.on('dragend', () => {
          const p = markers.get(id)!.getLatLng();
          handlers.onPlace(id, { lat: p.lat, lng: p.lng });
        });
        m.on('click', () => handlers.onSelect(id));
        markers.set(item.id, m);
      } else {
        m.setLatLng(latlng);
        m.setIcon(icon);
      }
      m.setZIndexOffset(item.active ? 1000 : 0);
      if (item.active) activeId = item.id;
    }
    for (const [id, m] of markers) {
      if (!seen.has(id)) {
        m.remove();
        markers.delete(id);
      }
    }
    activeId = list.find((i) => i.active)?.id ?? null;
  };
  setItems(items);

  map.on('click', (e: L.LeafletMouseEvent) => {
    if (activeId) handlers.onPlace(activeId, { lat: e.latlng.lat, lng: e.latlng.lng });
  });
  return {
    setItems,
    /** Flytta kartan till en plats utifrån (sökträff eller inskrivna koordinater) */
    panTo: (at: LatLng) => map.setView([at.lat, at.lng], Math.max(map.getZoom(), 13)),
    destroy: () => map.remove(),
  };
}

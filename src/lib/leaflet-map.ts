// Leaflet laddas bara dynamiskt (import('./leaflet-map')) och bara där en karta ska visas.
// Brickor från OpenStreetMap (https://operations.osmfoundation.org/policies/tiles/): behåll attributionen.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HOME, type LatLng } from './geo';
import { PLACE_ICON_GLYPHS, PLACE_ICON_LABELS, type ExtraPlace, type PlaceIcon } from './place-icons';

const ACCENT = '#8A4B9E';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

function baseMap(el: HTMLElement): L.Map {
  const map = L.map(el, {
    scrollWheelZoom: false,
    // En finger ska kunna skrolla sidan förbi kartan på mobil; nyp för att zooma
    dragging: !L.Browser.mobile,
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

/** Platsväljare för admin: klicka eller dra markören. `onPick` får nya koordinater. */
export function mountPickerMap(el: HTMLElement, start: LatLng | null, onPick: (at: LatLng) => void) {
  const map = baseMap(el);
  map.options.dragging = true;
  map.dragging.enable();
  map.setView(start ? [start.lat, start.lng] : [HOME.lat, HOME.lng], start ? 13 : 9);
  let marker: L.Marker | null = null;
  const place = (at: LatLng, pan: boolean) => {
    if (marker) marker.setLatLng([at.lat, at.lng]);
    else {
      marker = L.marker([at.lat, at.lng], { draggable: true, icon: pinIcon() }).addTo(map);
      marker.on('dragend', () => {
        const p = marker!.getLatLng();
        onPick({ lat: p.lat, lng: p.lng });
      });
    }
    if (pan) map.setView([at.lat, at.lng], Math.max(map.getZoom(), 13));
  };
  if (start) place(start, false);
  map.on('click', (e: L.LeafletMouseEvent) => {
    place({ lat: e.latlng.lat, lng: e.latlng.lng }, false);
    onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
  });
  return {
    /** Flytta markören utifrån (sökträff eller inskrivna koordinater) */
    setPosition: (at: LatLng | null) => {
      if (at) place(at, true);
      else if (marker) {
        marker.remove();
        marker = null;
      }
    },
    destroy: () => map.remove(),
  };
}

// Egen ikon: Leaflets standardbilder hittas inte efter bundling
function pinIcon() {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${ACCENT};border:3px solid #FFFEF8;box-shadow:0 2px 6px rgba(0,0,0,.4)"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

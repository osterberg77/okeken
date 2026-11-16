// Kartvisaren för orienteringskartor (beslut 0025). Laddas dynamiskt från MapsPage.
// OSM i botten (https://operations.osmfoundation.org/policies/tiles/, behåll attributionen), o-kartan ovanpå.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
    destroy() {
      map.stopLocate();
      map.remove();
    },
  };
}

import { HOME, haversineKm, type EventRoute, type LatLng } from '../geo';

// Bilväg från HOME via OSRM:s öppna demoserver (gratis, ingen nyckel). Hämtas bara vid bygget; misslyckas anropet
// visar sidan fågelvägen i stället. Anropen görs ett i taget och sparas i minnet under bygget.
const cache = new Map<string, Promise<EventRoute | null>>();
let queue: Promise<unknown> = Promise.resolve();

const MAX_POINTS = 60;

/** Douglas–Peucker på [lng, lat]; gott nog för en liten karta. */
function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len)) : 0;
    const d = Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

async function fetchRoute(to: LatLng): Promise<EventRoute | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${HOME.lng},${HOME.lat};${to.lng},${to.lat}` +
    '?overview=full&geometries=geojson';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'okeken.se site build' } });
    if (!res.ok) return null;
    const route = (await res.json())?.routes?.[0];
    if (!route?.geometry?.coordinates) return null;
    let tol = 0.0002;
    let points = simplify(route.geometry.coordinates as [number, number][], tol);
    while (points.length > MAX_POINTS && tol < 0.05) {
      tol *= 1.5;
      points = simplify(route.geometry.coordinates, tol);
    }
    return {
      km: Math.round(route.distance / 100) / 10,
      minutes: Math.round(route.duration / 60),
      points: points.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]),
    };
  } catch {
    return null;
  }
}

export function getRoute(to: LatLng): Promise<EventRoute | null> {
  // Hoppa över orimliga avstånd (OSRM:s demo är till för rimliga bilresor) och sådant som ligger i rondellen
  if (haversineKm(HOME, to) > 800) return Promise.resolve(null);
  const key = `${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = queue.then(() => fetchRoute(to));
    queue = hit.then(() => new Promise((r) => setTimeout(r, 1100)));
    cache.set(key, hit);
  }
  return hit;
}

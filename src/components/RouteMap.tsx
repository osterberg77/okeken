import { HOME, haversineKm, type EventRoute, type LatLng } from '../lib/geo';

const W = 600;
const H = 300;
const PAD = 46;
const ACCENT = '#8A4B9E';

interface Props {
  to: LatLng;
  /** Namn vid målet (platsen); utelämnas om det saknas */
  label?: string;
  route?: EventRoute;
}

// Samma kartbakgrund som kalenderpanelen (docs/skisser). Ren SVG, ingen JS och ingen extern kartserver:
// rutten kommer färdigräknad från bygget (src/lib/server/route.ts). Utan rutt ritas fågelvägen streckad.
export default function RouteMap({ to, label, route }: Props) {
  const line: [number, number][] = route ? route.points : [[HOME.lng, HOME.lat], [to.lng, to.lat]];
  const all: [number, number][] = [[HOME.lng, HOME.lat], [to.lng, to.lat], ...line];
  const lngs = all.map((p) => p[0]);
  const lats = all.map((p) => p[1]);
  const [lng0, lng1] = [Math.min(...lngs), Math.max(...lngs)];
  const [lat0, lat1] = [Math.min(...lats), Math.max(...lats)];
  const k = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
  const spanX = Math.max((lng1 - lng0) * k, 1e-4);
  const spanY = Math.max(lat1 - lat0, 1e-4);
  const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const pt = ([lng, lat]: [number, number]): [number, number] => [offX + (lng - lng0) * k * scale, offY + (lat1 - lat) * scale];

  const d = line.map((p, i) => `${i ? 'L' : 'M'}${pt(p).map((n) => n.toFixed(1)).join(' ')}`).join('');
  const [sx, sy] = pt([HOME.lng, HOME.lat]);
  const [ex, ey] = pt([to.lng, to.lat]);
  const km = route ? route.km : Math.round(haversineKm(HOME, to) * 10) / 10;
  // Namnen placeras lodrätt bort från den andra punkten (så att de inte hamnar på rutten) och vandrar inåt från kanten
  const labelAt = (x: number, y: number, ox: number, oy: number) => ({
    x: x + (x > W / 2 ? -16 : 16),
    y: oy < y ? y + 28 : y - 14,
    anchor: (x > W / 2 ? 'end' : 'start') as 'end' | 'start',
  });
  const startLabel = labelAt(sx, sy, ex, ey);
  const endLabel = labelAt(ex, ey, sx, sy);

  const summary = route
    ? `${route.km.toLocaleString('sv-SE')} km med bil, ca ${route.minutes} min`
    : `Ca ${km.toLocaleString('sv-SE')} km fågelvägen`;

  return (
    <figure className="m-0 flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Karta: ${summary} från ${HOME.name}`} className="block w-full rounded-[20px] bg-map">
        <svg width={W} height={H} viewBox="0 0 1240 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="1240" height="260" fill="#FFFEF8" />
          <path d="M0 190 C150 160 260 230 420 200 S700 150 860 190 S1120 220 1240 180 L1240 260 L0 260z" fill="#DDEBD0" opacity=".55" />
          <ellipse cx="1080" cy="60" rx="90" ry="26" fill="#D6EAF2" opacity=".7" />
          <g fill="none" stroke="#C9A77A" strokeWidth="1" opacity=".5">
            <path d="M0 50 C200 20 340 90 520 55 S860 20 1240 70" />
            <path d="M0 90 C180 60 330 130 520 95 S880 60 1240 110" />
            <path d="M0 130 C200 100 360 170 540 135 S900 100 1240 150" />
            <path d="M0 230 C200 205 360 250 560 225 S900 205 1240 240" />
          </g>
        </svg>
        <path d={d} fill="none" stroke="#FFFEF8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={d}
          fill="none"
          stroke={ACCENT}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={route ? undefined : '2 8'}
        />
        {/* Start: triangel, som på orienteringskartan */}
        <polygon points="0,-11 9.5,5.5 -9.5,5.5" transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) rotate(-30)`} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinejoin="round" />
        {/* Mål: dubbelring */}
        <circle cx={ex} cy={ey} r="6" fill="none" stroke={ACCENT} strokeWidth="3" />
        <circle cx={ex} cy={ey} r="11" fill="none" stroke={ACCENT} strokeWidth="2.5" />
        <Label {...startLabel} text={HOME.name} />
        {label && <Label {...endLabel} text={label} />}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-muted">
        <span>{summary} från {HOME.name}</span>
        <a
          href={`https://www.google.com/maps/dir/?api=1&origin=${HOME.lat},${HOME.lng}&destination=${to.lat},${to.lng}`}
          target="_blank"
          rel="noopener"
          className="font-semibold text-accent"
        >
          Vägbeskrivning ↗
        </a>
      </figcaption>
    </figure>
  );
}

function Label({ x, y, anchor, text }: { x: number; y: number; anchor: 'start' | 'end'; text: string }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize="15" fontWeight="600" fill="#2B2838" stroke="#FFFEF8" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">
      {text}
    </text>
  );
}

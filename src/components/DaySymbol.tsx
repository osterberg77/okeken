// Kalenderdagarna som en orienteringsbana. Geometrin är exakt enligt
// docs/skisser/kalender-och-kontrollsymboler.md – ändra inte utan att fråga Erik.

const ACCENT = '#8A4B9E';
const LINE = 'rgba(138,75,158,.62)';

export type DayKind = 'plain' | 'event' | 'today' | 'todayEvent';

function Leg({ x1, x2 }: { x1: number; x2: number }) {
  return <line x1={x1} y1="32" x2={x2} y2="32" stroke={LINE} strokeWidth="2" />;
}

function DoubleRing() {
  return (
    <>
      <circle cx="36" cy="32" r="23.1" fill="none" stroke={ACCENT} strokeWidth="2.6" />
      <circle cx="36" cy="32" r="16" fill="none" stroke={ACCENT} strokeWidth="2.6" />
    </>
  );
}

function Triangle({ points }: { points: string }) {
  return (
    <polygon
      transform="rotate(-30 36 32)"
      points={points}
      fill="none"
      stroke={ACCENT}
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
  );
}

export default function DaySymbol({ kind }: { kind: DayKind }) {
  return (
    <svg viewBox="0 0 72 64" width="72" height="64" aria-hidden="true" className="block overflow-visible">
      {kind === 'today' ? (
        <>
          <Leg x1={0} x2={21.2} />
          <Leg x1={65.65} x2={72} />
          <Triangle points="36,2.35 61.68,46.83 10.32,46.83" />
        </>
      ) : (
        <>
          <Leg x1={0} x2={12.9} />
          <Leg x1={59.1} x2={72} />
          {kind === 'plain' && (
            <circle opacity="0.75" cx="36" cy="32" r="23.1" fill="none" stroke={LINE} strokeWidth="2.6" />
          )}
          {kind === 'event' && <DoubleRing />}
          {kind === 'todayEvent' && (
            <>
              <DoubleRing />
              <Triangle points="36,4.1 60.16,45.95 11.84,45.95" />
            </>
          )}
        </>
      )}
    </svg>
  );
}

/** Liten starttriangel för "idag"-knappen */
export function StartIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <polygon
        transform="rotate(-30 10 10)"
        points="10,1.5 17.4,14.3 2.6,14.3"
        fill="none"
        stroke={ACCENT}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

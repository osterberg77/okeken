import { formatDuration, groupByCourse } from '../lib/results';
import type { PublicResultEntry } from '../types/result';

/** Publik resultatlista per bana: placering och tid, därefter de som bara deltagit. Samma komponent i bygget och i adminförhandsvisningen. */
export default function ResultsList({ entries }: { entries: PublicResultEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 font-display text-lg font-bold">Resultat</h3>
      {groupByCourse(entries).map((g) => {
        const timed = g.entries.filter((e) => e.seconds !== null);
        const others = g.entries.filter((e) => e.seconds === null);
        return (
          <section key={g.course} className="flex flex-col gap-1.5">
            {g.course && <h4 className="m-0 text-[15px] font-semibold">{g.course}</h4>}
            {timed.length > 0 && (
              <ol className="m-0 flex list-none flex-col p-0">
                {timed.map((e, i) => (
                  <li key={`${e.name}-${i}`} className="flex items-baseline gap-3 border-b border-ink/8 py-1.5 text-[15px] last:border-b-0">
                    <span className="w-6 flex-none text-right text-subtle tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1">{e.name}</span>
                    <span className="flex-none font-semibold tabular-nums">{formatDuration(e.seconds!)}</span>
                  </li>
                ))}
              </ol>
            )}
            {others.length > 0 && (
              <p className="m-0 text-sm text-muted">
                Deltog också: {others.map((e) => e.name).join(', ')}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

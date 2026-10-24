import { useEffect, useMemo, useState } from 'react';
import { swishOpenLink } from '../lib/membership';
import { currentYear, getFees } from '../lib/firebase/membership';
import { registerSelfResult } from '../lib/firebase/results';
import { watchSession } from '../lib/firebase/session';
import { formatDuration, parseDuration } from '../lib/results';
import { SHOW_LABELS, SHOW_MODES, type ShowMode } from '../types/result';
import type { Session } from '../types/user';
import { Field, INPUT } from './admin/AdminUi';

interface Training {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
}

const card = 'flex flex-col gap-5 rounded-[28px] bg-white px-6 py-8 shadow-card sm:px-[38px] sm:py-[38px]';
const SWISH_MESSAGE = 'OK Eken kartbidrag';

/** Förvalt event: pågående träning (den senast startade), annars den senast startade, annars den som startar närmast. */
export function defaultTraining(list: Training[], now: number): Training | undefined {
  const started = list.filter((e) => Date.parse(e.startsAt) <= now).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const running = started.find((e) => Date.parse(e.endsAt) >= now);
  return running ?? started[0] ?? [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Sidan som QR-koden vid starten pekar på (beslut 0022): registrera att man sprungit, med valfri tid, val om vad som
 * visas, betyg på banan och en Swish-länk för frivilligt kartbidrag. Fungerar utan inloggning.
 */
export default function SelfRegister({ events }: { events: Training[] }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [slug, setSlug] = useState(() => defaultTraining(events, Date.now())?.slug ?? '');
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [time, setTime] = useState('');
  const [show, setShow] = useState<ShowMode>('participated');
  const [rating, setRating] = useState<number | null>(null);
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ updated: boolean } | null>(null);
  const [swish, setSwish] = useState('');

  useEffect(() => watchSession(setSession), []);

  const seconds = useMemo(() => (time.trim() ? parseDuration(time) : null), [time]);
  const timeBad = time.trim() !== '' && seconds === null;
  const event = events.find((e) => e.slug === slug);
  const member = !!session && session.permissions.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!event || busy || timeBad) return;
    if (!member && !name.trim()) return setError('Fyll i ditt namn.');
    setBusy(true);
    setError('');
    try {
      setDone(await registerSelfResult({ slug, name: name.trim(), course, totalSeconds: seconds, show, rating, trap }));
      // Swish-numret hämtas först nu (en läsning), inte för alla som bara öppnar sidan
      getFees(currentYear()).then((f) => setSwish(f?.swishNumber ?? ''), () => {});
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Kunde inte spara. Försök igen.');
    } finally {
      setBusy(false);
    }
  }

  if (events.length === 0) return <div className={card}><p className="m-0">Det finns ingen träning att registrera sig på just nu.</p></div>;

  if (done) {
    return (
      <div className={card}>
        <h1 className="m-0 font-display text-[28px] font-bold">Tack!</h1>
        <p className="m-0">{done.updated ? 'Din registrering är uppdaterad.' : 'Du är registrerad.'} Roligt att du var ute i skogen.</p>
        {swish && (
          <div className="flex flex-col gap-2 rounded-2xl bg-period p-4">
            <p className="m-0 text-[15px]">Vill du stötta klubben med en liten slant till kartorna? Helt frivilligt.</p>
            <a href={swishOpenLink(swish, SWISH_MESSAGE)} className="self-start rounded-full bg-accent px-6 py-3 text-base font-semibold text-white no-underline hover:brightness-110">
              Swisha valfritt belopp
            </a>
            <span className="text-[13px] text-muted">Öppnar Swish-appen på mobilen. Du väljer summan själv.</span>
          </div>
        )}
        <button type="button" onClick={() => setDone(null)} className="cursor-pointer self-start border-0 bg-transparent p-0 text-sm font-semibold text-accent hover:underline">
          Ändra min registrering
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={card}>
      <h1 className="m-0 font-display text-[28px] font-bold">Jag har sprungit</h1>
      <p className="m-0 text-muted">Registrera gärna att du varit ute, så vet vi att våra banor uppskattas. Tid och namn är valfria att visa.</p>

      {events.length > 1 && (
        <Field label="Träning" htmlFor="ev">
          <select id="ev" value={slug} onChange={(e) => setSlug(e.target.value)} className={INPUT}>
            {[...events].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((e) => (
              <option key={e.slug} value={e.slug}>{e.title} – {dayLabel(e.startsAt)}</option>
            ))}
          </select>
        </Field>
      )}
      {event && events.length === 1 && <p className="m-0 font-semibold">{event.title} – {dayLabel(event.startsAt)}</p>}

      {member ? (
        <p className="m-0">Du registreras som <strong>{session!.displayName}</strong>.</p>
      ) : (
        <Field label="Ditt namn" htmlFor="nm" hint={session === undefined ? undefined : 'Har du konto? Logga in så fylls namnet i åt dig.'}>
          <input id="nm" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" className={INPUT} />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bana (valfritt)" htmlFor="co" hint="T.ex. Röd, Blå eller Lätt.">
          <input id="co" value={course} onChange={(e) => setCourse(e.target.value)} maxLength={100} className={INPUT} />
        </Field>
        <Field label="Din tid (valfritt)" htmlFor="tm" hint={timeBad ? 'Skriv t.ex. 42:30 (minuter:sekunder).' : seconds !== null ? `Tolkas som ${formatDuration(seconds)}` : 'T.ex. 42:30'}>
          <input id="tm" value={time} onChange={(e) => setTime(e.target.value)} inputMode="numeric" placeholder="mm:ss" className={INPUT} />
        </Field>
      </div>

      <Field label="Vad får visas i resultatlistan?" htmlFor="sh" hint="Du räknas med i statistiken oavsett. Väljer du Dölj publiceras inget om dig.">
        <select id="sh" value={show} onChange={(e) => setShow(e.target.value as ShowMode)} className={INPUT}>
          {SHOW_MODES.filter((m) => m !== 'time' || seconds !== null).map((m) => <option key={m} value={m}>{SHOW_LABELS[m]}</option>)}
        </select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-[15px] font-semibold">Vad tyckte du om banan? (valfritt)</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Betyg">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} av 5`}
              onClick={() => setRating(rating === n ? null : n)}
              className={`cursor-pointer border-0 bg-transparent p-1 text-4xl leading-none ${rating !== null && n <= rating ? 'text-accent' : 'text-ink/25'}`}
            >
              ★
            </button>
          ))}
        </div>
        <span className="text-[13px] text-muted">Betyget ser bara klubben, det visas inte på sajten.</span>
      </div>

      {/* Lockbete för skript: människor ser det aldrig */}
      <input value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      {error && <p role="alert" className="m-0 text-[#8A2B2B]">{error}</p>}
      <button type="submit" disabled={busy || !event || timeBad} className="cursor-pointer self-start rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-white shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110 disabled:cursor-default disabled:opacity-45">
        {busy ? 'Sparar…' : 'Registrera'}
      </button>
      <p className="m-0 text-[13px] text-muted">
        Klubben sparar uppgifterna för statistik och resultat, se <a href="/integritet" className="font-semibold text-accent">integritetspolicyn</a>.
        Har du konto? <a href="/logga-in?next=/ute" className="font-semibold text-accent">Logga in</a> först.
      </p>
    </form>
  );
}

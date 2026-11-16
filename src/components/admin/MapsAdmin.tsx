import { useEffect, useRef, useState } from 'react';
import { createMap, MapFileRejected, renameMap, uploadMapSource, watchMaps } from '../../lib/firebase/maps';
import { TZ } from '../../lib/time';
import { MAP_ID_PATTERN, MAX_MAP_NAME, mapIdFromName, type OMap } from '../../types/map';
import { canPublish } from '../../types/user';
import { ActionButton, Field, INPUT } from './AdminUi';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';

const dateFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const when = (d: Date | null) => (d ? dateFmt.format(d) : '');

/** Orienteringskartor (beslut 0025): skapa en karta och ladda upp nya versioner, som konverteras till kartlager. */
export default function MapsAdmin() {
  return (
    <AdminGate allowed={canPublish} requirement="publicerare, styrelse eller superadmin">
      {() => <Maps />}
    </AdminGate>
  );
}

function Maps() {
  const [maps, setMaps] = useState<OMap[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => watchMaps(setMaps, () => setError('Kunde inte läsa kartorna.')), []);

  return (
    <AdminPanel>
      <div>
        <AdminTitle>Kartor</AdminTitle>
        <p className="mt-2 text-muted">
          Orienteringskartor som medlemmar kan se på <a href="/kartor" className="font-semibold text-accent">kartsidan</a>. Ladda upp
          kartfilen från OpenOrienteering Mapper (.omap) eller OCAD (.ocd). Den görs om till ett kartlager, vilket tar ungefär tio
          minuter. Den gamla versionen visas tills den nya är klar.
        </p>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
      {maps === null && !error && <p className="text-muted">Laddar kartor…</p>}
      {maps && maps.length === 0 && <p className="text-muted">Inga kartor ännu.</p>}

      {maps && maps.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {maps.map((m) => (
            <MapRow key={m.id} map={m} />
          ))}
        </ul>
      )}

      {maps && <NewMap existing={maps.map((m) => m.id)} />}
    </AdminPanel>
  );
}

function JobStatus({ map }: { map: OMap }) {
  const job = map.job;
  if (!job) return null;
  if (job.status === 'queued') return <p className="m-0 text-sm font-semibold text-[#8A6A00]">{job.sourceName} väntar på att byggas…</p>;
  if (job.status === 'running') return <p className="m-0 text-sm font-semibold text-[#8A6A00]">Bygger {job.sourceName}, ca tio minuter…</p>;
  if (job.status === 'failed') {
    return (
      <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-3 py-2 text-sm text-[#8A2B2B]">
        {job.sourceName} gick inte att bygga{job.error ? `: ${job.error}` : '.'} Kontrollera att kartan är georefererad i Mapper och försök igen.
      </p>
    );
  }
  return null;
}

function MapRow({ map }: { map: OMap }) {
  const file = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(map.name);
  const busy = map.job?.status === 'queued' || map.job?.status === 'running';

  async function upload(f: File | undefined) {
    if (!f) return;
    setError('');
    setProgress(0);
    try {
      await uploadMapSource(map.id, f, setProgress);
    } catch (err) {
      setError(err instanceof MapFileRejected ? err.message : 'Uppladdningen misslyckades. Försök igen.');
    } finally {
      setProgress(null);
      if (file.current) file.current.value = '';
    }
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === map.name) return setEditing(false);
    try {
      await renameMap(map.id, trimmed);
      setEditing(false);
    } catch {
      setError('Kunde inte byta namn.');
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-[22px] bg-period px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input value={name} maxLength={MAX_MAP_NAME} onChange={(e) => setName(e.target.value)} aria-label="Kartans namn" className={`${INPUT} max-w-xs`} />
            <ActionButton primary onClick={saveName}>Spara</ActionButton>
            <ActionButton onClick={() => { setName(map.name); setEditing(false); }}>Avbryt</ActionButton>
          </div>
        ) : (
          <h2 className="m-0 font-display text-xl font-bold">
            {map.name}{' '}
            <button type="button" onClick={() => setEditing(true)} className="cursor-pointer text-sm font-semibold text-accent">Byt namn</button>
          </h2>
        )}
        {map.current && (
          <a href={`/kartor?karta=${map.id}`} className="text-sm font-semibold text-accent">Visa kartan</a>
        )}
      </div>
      <p className="m-0 text-sm text-muted">
        {map.current
          ? `Visas nu: ${map.current.sourceName}, byggd ${when(map.current.builtAt)}, skala 1:${map.current.scale.toLocaleString('sv-SE')}`
          : 'Ingen version uppladdad ännu.'}
      </p>
      <JobStatus map={map} />
      <div className="flex flex-wrap items-center gap-3">
        <input ref={file} type="file" accept=".omap,.ocd" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <ActionButton onClick={() => file.current?.click()} disabled={progress !== null || busy}>
          {map.current ? 'Ladda upp ny version' : 'Ladda upp karta'}
        </ActionButton>
        {progress !== null && <span className="text-sm text-muted">Laddar upp {Math.round(progress * 100)} %</span>}
      </div>
      {error && <p role="alert" className="m-0 text-sm text-[#8A2B2B]">{error}</p>}
    </li>
  );
}

function NewMap({ existing }: { existing: string[] }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = mapIdFromName(name);
  const taken = existing.includes(id);

  async function create() {
    setError('');
    if (!MAP_ID_PATTERN.test(id)) return setError('Skriv ett namn med minst en bokstav eller siffra.');
    if (taken) return setError('Det finns redan en karta med det namnet.');
    setBusy(true);
    try {
      await createMap(id, name.trim());
      setName('');
    } catch {
      setError('Kunde inte skapa kartan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-ink/10 pt-5">
      <Field label="Ny karta" htmlFor="new-map" hint={id ? `Kartans id blir ${id}` : 'T.ex. Botorp eller Åtvid'}>
        <input id="new-map" value={name} maxLength={MAX_MAP_NAME} onChange={(e) => setName(e.target.value)} className={`${INPUT} sm:max-w-sm`} />
      </Field>
      <div>
        <ActionButton primary onClick={create} busy={busy} disabled={!name.trim()}>Skapa karta</ActionButton>
      </div>
      {error && <p role="alert" className="m-0 text-sm text-[#8A2B2B]">{error}</p>}
    </div>
  );
}

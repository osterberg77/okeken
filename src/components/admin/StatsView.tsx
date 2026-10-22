import { useEffect, useState } from 'react';
import { loadStats, totals, type Stats } from '../../lib/firebase/stats';
import { canPublish } from '../../types/user';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';

const RANGES = [
  { days: 7, label: '7 dagar' },
  { days: 30, label: '30 dagar' },
  { days: 90, label: '90 dagar' },
] as const;

const REGION = new Intl.DisplayNames(['sv'], { type: 'region' });
const countryName = (code: string) => {
  if (code === '??') return 'Okänt';
  try {
    return REGION.of(code) ?? code;
  } catch {
    return code;
  }
};
const sourceName = (s: string) => (s === 'direkt' ? 'Direkt / okänt' : s === 'intern' ? 'Inom sajten' : s);

/** Datum som ÅÅÅÅ-MM-DD i Europe/Stockholm, `days - 1` dagar före idag (så att "7 dagar" inkluderar idag) */
function fromDay(days: number): string {
  const d = new Date(Date.now() - (days - 1) * 86400_000);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export default function StatsView() {
  return (
    <AdminGate allowed={canPublish} requirement="publicerare, styrelse eller superadmin">
      {() => <Stats />}
    </AdminGate>
  );
}

function Stats() {
  const [days, setDays] = useState<number>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setStats(null);
    setError('');
    loadStats(fromDay(days)).then(
      (s) => live && setStats(s),
      () => live && setError('Kunde inte läsa statistiken.'),
    );
    return () => {
      live = false;
    };
  }, [days]);

  const views = stats?.pages.reduce((n, p) => n + p.views, 0) ?? 0;
  const unique = stats?.pages.reduce((n, p) => n + p.unique, 0) ?? 0;
  const downloads = stats?.downloads.reduce((n, d) => n + d.count, 0) ?? 0;

  return (
    <AdminPanel>
      <div>
        <AdminTitle>Besöksstatistik</AdminTitle>
        <p className="mt-2 max-w-[60ch] text-muted">
          Räknas utan kakor och utan att spara IP-adresser. Inloggade och bottar räknas inte. "Unika" är besökare per sida och dag, så samma person kan räknas på flera sidor.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            aria-pressed={days === r.days}
            onClick={() => setDays(r.days)}
            className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold ${days === r.days ? 'bg-accent text-white' : 'bg-period text-ink hover:bg-pastel'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
      {!stats && !error && <p className="text-muted">Laddar…</p>}

      {stats && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Sidvisningar" value={views} />
            <Tile label="Unika besök" value={unique} />
            <Tile label="Nedladdningar" value={downloads} />
          </div>

          <Section title="Mest besökta sidor">
            <Table head={['Sida', 'Visningar', 'Unika']} rows={stats.pages.slice(0, 25).map((p) => [<code key="p">{p.path}</code>, p.views, p.unique])} empty="Inga besök ännu." />
          </Section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Varifrån besökarna kommer">
              <Table head={['Källa', 'Visningar']} rows={totals(stats.pages, 'sources').slice(0, 15).map(([k, n]) => [sourceName(k), n])} empty="Inga besök ännu." />
            </Section>
            <Section title="Länder">
              <Table head={['Land', 'Visningar']} rows={totals(stats.pages, 'countries').slice(0, 15).map(([k, n]) => [countryName(k), n])} empty="Inga besök ännu." />
            </Section>
          </div>

          <Section title="Nedladdningar per fil och sida">
            <Table
              head={['Fil', 'Sida', 'Antal']}
              rows={stats.downloads.slice(0, 50).map((d) => [d.file, <code key="p">{d.path}</code>, d.count])}
              empty="Inga nedladdningar ännu."
            />
          </Section>
        </>
      )}
    </AdminPanel>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-period px-5 py-4">
      <div className="font-display text-[32px] leading-none font-bold">{value.toLocaleString('sv-SE')}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="m-0 font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[15px]">
        <thead>
          <tr className="border-b border-ink/12 text-[13px] text-muted">
            {head.map((h, i) => (
              <th key={h} className={`py-2 pr-3 font-semibold ${i === head.length - 1 || (head.length === 3 && i > 0 && typeof rows[0][i] === 'number') ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-ink/8">
              {r.map((c, j) => (
                <td key={j} className={`py-2 pr-3 break-all ${typeof c === 'number' ? 'text-right tabular-nums' : ''}`}>{typeof c === 'number' ? c.toLocaleString('sv-SE') : c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

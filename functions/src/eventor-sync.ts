// Hämtar tävlingar från Eventor till spegeln eventorEvents. Publicerarens val (`selected`) skrivs aldrig över.
// Urvalsreglerna läses ur settings/eventor (standardvärden om dokumentet saknas). Se docs/eventor.md.
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { XMLParser } from 'fast-xml-parser';

const API = 'https://eventor.orientering.se/api';
const DEFAULTS = {
  ownOrganisationId: 510,
  organisationIds: [24],
  classificationIds: [1, 2, 3],
  disciplineIds: [1],
  monthsAhead: 12,
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Element som kan upprepas ska alltid bli listor, så att parsningen inte beror på hur många som kom
  isArray: (name) => ['Event', 'Organisation'].includes(name),
});

/* eslint-disable @typescript-eslint/no-explicit-any */
async function get(path: string, key: string): Promise<any> {
  const res = await fetch(`${API}/${path}`, { headers: { ApiKey: key } });
  if (!res.ok) throw new Error(`Eventor svarade ${res.status} på /${path.split('?')[0]}`);
  return parser.parse(await res.text());
}

/** Eventor anger svensk lokal tid utan zon. Returnerar motsvarande UTC-ögonblick (hanterar sommartid). */
export function stockholmToDate(date: string, clock: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = clock.split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm, ss ?? 0);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Stockholm',
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(asUtc)).map((x) => [x.type, Number(x.value)]));
  const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(asUtc - (shown - asUtc));
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const asList = (v: any): any[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export interface SyncResult {
  fetched: number;
  added: number;
  updated: number;
  removed: number;
  gone: number;
  suggested: number;
}

export async function syncEventor(db: Firestore, key: string): Promise<SyncResult> {
  const snap = await db.doc('settings/eventor').get();
  const rules = { ...DEFAULTS, ...(snap.exists ? snap.data() : {}) };

  const from = new Date();
  const to = new Date(from);
  to.setMonth(to.getMonth() + rules.monthsAhead);

  const [events, orgs] = await Promise.all([
    get(
      `events?organisationIds=${rules.organisationIds.join(',')}` +
        `&fromDate=${ymd(from)}%2000:00:00&toDate=${ymd(to)}%2023:59:59`,
      key,
    ),
    get('organisations', key),
  ]);
  // Ett tomt eller trasigt svar får aldrig tolkas som "alla tävlingar är borta"
  if (!events?.EventList) throw new Error('Oväntat svar från Eventor (ingen EventList).');
  const orgNames = new Map<number, string>(
    asList(orgs?.OrganisationList?.Organisation).map((o) => [Number(o.OrganisationId), String(o.ShortName ?? o.Name)]),
  );

  const now = Timestamp.now();
  const fetched = new Map<string, FirebaseFirestore.DocumentData>();
  for (const e of asList(events.EventList.Event)) {
    const id = String(e.EventId);
    const start = e.StartDate;
    const finish = e.FinishDate ?? e.StartDate;
    const allDay = start.Clock === '00:00:00';
    const organiserId = e.Organiser?.OrganisationId !== undefined ? Number(e.Organiser.OrganisationId) : null;
    const classificationId = Number(e.EventClassificationId);
    const disciplineId = Number(e.DisciplineId);
    fetched.set(id, {
      name: String(e.Name),
      startsAt: Timestamp.fromDate(stockholmToDate(start.Date, start.Clock)),
      endsAt: Timestamp.fromDate(stockholmToDate(finish.Date, allDay ? '23:59:59' : finish.Clock)),
      allDay,
      organiserId,
      organiserName: (organiserId !== null && orgNames.get(organiserId)) || '',
      classificationId,
      disciplineId,
      statusId: Number(e.EventStatusId),
      form: e['@_eventForm'] ?? '',
      url: `https://eventor.orientering.se/Events/Show/${id}`,
      webUrl: typeof e.WebURL === 'string' ? e.WebURL : '',
      suggested:
        organiserId === rules.ownOrganisationId ||
        (rules.classificationIds.includes(classificationId) && rules.disciplineIds.includes(disciplineId)),
      gone: false,
      fetchedAt: now,
    });
  }

  const existing = new Map((await db.collection('eventorEvents').get()).docs.map((d) => [d.id, d.data()]));
  const batch = db.batch();
  const result: SyncResult = { fetched: fetched.size, added: 0, updated: 0, removed: 0, gone: 0, suggested: 0 };

  for (const [id, data] of fetched) {
    const ref = db.doc(`eventorEvents/${id}`);
    if (data.suggested) result.suggested++;
    if (existing.has(id)) {
      batch.update(ref, data); // rör inte selected/selectedBy/selectedAt
      result.updated++;
    } else {
      batch.set(ref, { ...data, selected: false, selectedBy: null, selectedAt: null });
      result.added++;
    }
  }
  for (const [id, old] of existing) {
    if (fetched.has(id)) continue;
    const ref = db.doc(`eventorEvents/${id}`);
    const past = (old.endsAt as Timestamp).toMillis() < from.getTime();
    if (old.selected && !past) {
      batch.update(ref, { gone: true });
      result.gone++;
    } else {
      batch.delete(ref);
      result.removed++;
    }
  }
  await batch.commit();
  return result;
}

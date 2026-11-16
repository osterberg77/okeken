// Orienteringskartor (beslut 0025): en uppladdad originalfil startar konverteringsjobbet i Cloud Run.
// Bara Date och vanliga värden (ingen FieldValue-klass), så att testerna kan köra mot rotens firebase-admin.
import type { Firestore } from 'firebase-admin/firestore';

export const MAP_JOB_REGION = 'europe-north1';
export const MAP_JOB_NAME = 'map-converter';

export interface MapSource {
  mapId: string;
  sourcePath: string;
  /** Filnamnet som det laddades upp, utan tidsstämpeln */
  sourceName: string;
}

/** map_sources/<mapId>/<13 siffror>-<namn>.<omap|ocd>, annars null (andra filer i bucketen ignoreras). */
export function parseMapSource(path: string | undefined): MapSource | null {
  const m = /^map_sources\/([a-z0-9][a-z0-9-]{0,39})\/[0-9]{13}-([A-Za-z0-9][A-Za-z0-9._-]{0,99}[.](?:omap|ocd))$/.exec(path ?? '');
  return m ? { mapId: m[1], sourcePath: path!, sourceName: m[2] } : null;
}

/** Markerar att en ny version väntar. Senaste uppladdningen vinner: jobbet byter bara `current` om sourcePath fortfarande stämmer. */
export async function queueMapJob(db: Firestore, source: MapSource): Promise<boolean> {
  const ref = db.doc(`maps/${source.mapId}`);
  if (!(await ref.get()).exists) return false;
  await ref.update({
    job: { status: 'queued', sourcePath: source.sourcePath, sourceName: source.sourceName, queuedAt: new Date() },
  });
  return true;
}

export async function markMapJobFailed(db: Firestore, source: MapSource, error: string) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`maps/${source.mapId}`);
    if ((await tx.get(ref)).data()?.job?.sourcePath !== source.sourcePath) return;
    tx.update(ref, { 'job.status': 'failed', 'job.error': error.slice(0, 500), 'job.finishedAt': new Date() });
  });
}

/** Startar Cloud Run-jobbet med kartan som parametrar (Cloud Run Admin API v2, jobs.run med overrides). */
export async function runMapJob(project: string, accessToken: string, source: MapSource): Promise<void> {
  const url = `https://run.googleapis.com/v2/projects/${project}/locations/${MAP_JOB_REGION}/jobs/${MAP_JOB_NAME}:run`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      overrides: {
        containerOverrides: [
          {
            env: [
              { name: 'MAP_ID', value: source.mapId },
              { name: 'SOURCE_PATH', value: source.sourcePath },
            ],
          },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`Cloud Run svarade ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

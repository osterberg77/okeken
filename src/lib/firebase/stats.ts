import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './client';

// Dagliga räknare från Cloud Function `hit` (beslut 0014). Klienten läser bara; reglerna släpper in publicerare uppåt.

export interface PageStats {
  path: string;
  views: number;
  unique: number;
  sources: Record<string, number>;
  countries: Record<string, number>;
}

export interface DownloadStats {
  path: string;
  file: string;
  count: number;
}

export interface Stats {
  pages: PageStats[];
  downloads: DownloadStats[];
}

const sum = (into: Record<string, number>, from: unknown) => {
  if (typeof from !== 'object' || from === null) return;
  for (const [k, v] of Object.entries(from)) if (typeof v === 'number') into[k] = (into[k] ?? 0) + v;
};

/** Summerar dagarna från och med `fromDay` (ÅÅÅÅ-MM-DD) per sida respektive per sida och fil */
export async function loadStats(fromDay: string): Promise<Stats> {
  const [pageSnap, dlSnap] = await Promise.all([
    getDocs(query(collection(db, 'statsPages'), where('date', '>=', fromDay))),
    getDocs(query(collection(db, 'statsDownloads'), where('date', '>=', fromDay))),
  ]);

  const pages = new Map<string, PageStats>();
  for (const d of pageSnap.docs) {
    const x = d.data();
    const p = pages.get(x.path) ?? { path: x.path, views: 0, unique: 0, sources: {}, countries: {} };
    p.views += x.views ?? 0;
    p.unique += x.unique ?? 0;
    sum(p.sources, x.sources);
    sum(p.countries, x.countries);
    pages.set(x.path, p);
  }

  const downloads = new Map<string, DownloadStats>();
  for (const d of dlSnap.docs) {
    const x = d.data();
    const key = `${x.path}|${x.file}`;
    const e = downloads.get(key) ?? { path: x.path, file: x.file, count: 0 };
    e.count += x.count ?? 0;
    downloads.set(key, e);
  }
  return { pages: [...pages.values()].sort((a, b) => b.views - a.views), downloads: [...downloads.values()].sort((a, b) => b.count - a.count) };
}

/** Summerar ett fält över alla sidor, störst först */
export function totals(pages: PageStats[], field: 'sources' | 'countries'): [string, number][] {
  const t: Record<string, number> = {};
  for (const p of pages) sum(t, p[field]);
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
}

// Import av banor från IOF XML 3.0 (CourseData), t.ex. exporterat från Purple Pen.
// Ingen DOM och inga beroenden: formatet är regelbundet och filerna små, så en liten taggläsare räcker.
import type { CoursePoint } from '../types/map';

export interface ImportedCourse {
  name: string;
  points: CoursePoint[];
}

interface Node {
  name: string;
  attrs: Record<string, string>;
  children: Node[];
  text: string;
}

const local = (n: string) => n.slice(n.indexOf(':') + 1);

function parseXml(xml: string): Node {
  const root: Node = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const tag = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  for (const m of xml.matchAll(tag)) {
    const top = stack[stack.length - 1];
    if (m[3] === undefined) {
      top.text += m[1] ?? m[6] ?? '';
    } else if (m[2]) {
      if (stack.length > 1) stack.pop();
    } else {
      const attrs: Record<string, string> = {};
      for (const a of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[local(a[1])] = a[2] ?? a[3];
      const node: Node = { name: local(m[3]), attrs, children: [], text: '' };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    }
  }
  return root;
}

const kids = (n: Node | undefined, name: string) => n?.children.filter((c) => c.name === name) ?? [];
const kid = (n: Node | undefined, name: string) => kids(n, name)[0];
const textOf = (n: Node | undefined) => n?.text.trim() ?? '';

/** Läser alla banor i filen. Kastar `Error` med svensk text om filen inte går att använda. */
export function parseIofCourses(xml: string): ImportedCourse[] {
  const doc = parseXml(xml);
  const data = kid(doc, 'CourseData');
  if (!data) throw new Error('Filen ser inte ut som en IOF XML-banfil (CourseData saknas). Exportera från Purple Pen: Arkiv > Exportera > IOF XML 3.0.');
  const race = kid(data, 'RaceCourseData');

  const controls = new Map<string, CoursePoint | null>();
  for (const c of kids(race, 'Control')) {
    const pos = kid(c, 'Position');
    const lat = Number(pos?.attrs.lat);
    const lng = Number(pos?.attrs.lng);
    controls.set(textOf(kid(c, 'Id')), pos && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null);
  }

  const courses: ImportedCourse[] = [];
  let missing = false;
  for (const course of kids(race, 'Course')) {
    const points: CoursePoint[] = [];
    for (const cc of kids(course, 'CourseControl')) {
      const p = controls.get(textOf(kid(cc, 'Control')));
      if (p) points.push(p);
      else missing = true;
    }
    if (points.length > 0) courses.push({ name: textOf(kid(course, 'Name')), points });
  }
  if (courses.length === 0) {
    throw new Error(
      missing
        ? 'Banfilen saknar koordinater (lat/lng). Purple Pen skriver dem bara om kartan i Purple Pen har georeferens, t.ex. en OCAD- eller OMAP-fil med koordinatsystem.'
        : 'Hittade inga banor i filen.',
    );
  }
  return courses;
}

/** Är någon punkt längre än `marginDeg` utanför kartans gränser [syd, väst, nord, öst]? */
export function outsideBounds(points: CoursePoint[], b: [number, number, number, number], marginDeg = 0.005): boolean {
  return points.some((p) => p.lat < b[0] - marginDeg || p.lat > b[2] + marginDeg || p.lng < b[1] - marginDeg || p.lng > b[3] + marginDeg);
}

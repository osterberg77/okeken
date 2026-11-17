import { describe, expect, it } from 'vitest';
import { outsideBounds, parseIofCourses } from '../../src/lib/iof-xml';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CourseData xmlns="http://www.orienteering.org/datastandard/3.0" iofVersion="3.0">
  <RaceCourseData>
    <Control type="Start"><Id>S1</Id><Position lng="15.5" lat="58.1"/><MapPosition x="1" y="2" unit="mm"/></Control>
    <Control type="Control"><Id>31</Id><Position lng="15.51" lat="58.11"/></Control>
    <Control type="Finish"><Id>F1</Id><Position lng="15.52" lat="58.12"/></Control>
    <Course>
      <Name>Tisdag</Name>
      <CourseControl type="Start"><Control>S1</Control></CourseControl>
      <CourseControl type="Control"><Control>31</Control></CourseControl>
      <CourseControl type="Finish"><Control>F1</Control></CourseControl>
    </Course>
  </RaceCourseData>
</CourseData>`;

describe('parseIofCourses', () => {
  it('reads course points in order', () => {
    const [c] = parseIofCourses(xml);
    expect(c.name).toBe('Tisdag');
    expect(c.points).toEqual([
      { lat: 58.1, lng: 15.5 },
      { lat: 58.11, lng: 15.51 },
      { lat: 58.12, lng: 15.52 },
    ]);
  });

  it('explains when coordinates are missing', () => {
    expect(() => parseIofCourses(xml.replace(/<Position[^>]*\/>/g, ''))).toThrow(/georeferens/);
  });

  it('rejects other XML', () => {
    expect(() => parseIofCourses('<foo/>')).toThrow(/CourseData/);
  });

  it('detects points outside the map', () => {
    expect(outsideBounds([{ lat: 58.1, lng: 15.5 }], [58, 15, 58.2, 15.6])).toBe(false);
    expect(outsideBounds([{ lat: 59, lng: 15.5 }], [58, 15, 58.2, 15.6])).toBe(true);
  });
});

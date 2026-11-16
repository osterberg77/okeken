#!/usr/bin/env node
// Builds georeferenced XYZ raster tiles from an OpenOrienteering Mapper map.
//
//   node scripts/map-tiles.mjs <map.omap|map.ocd> <outDir> [--dpi 600] [--zoom 12-17]
//                              [--colors 128] [--keep]
//
// Pipeline: panmap export -> SVG (paper coords, 0.01 mm units, y down)
//           rsvg-convert  -> PNG at --dpi
//           world file (.pgw) from the map's <georeferencing> (scale,
//           grivation, ref point, combined scale factor, as in Mapper)
//           gdal2tiles    -> <outDir>/tiles/{z}/{x}/{y}.png (XYZ, EPSG:3857)
//           pngquant      -> 8-bit palette tiles (--colors 0 keeps full RGBA)
//
// Requires: Node >= 18, rsvg-convert, GDAL (gdal_translate, gdal2tiles.py, proj), pngquant
// and a built panmap checkout (AGPL-3.0, https://github.com/kiwirm/panmap),
// pointed to by PANMAP=/path/to/panmap/dist/cli/main.js.
//
// Note: panmap's own GeoJSON export mirrors northings around the ref point
// (it adds the paper y instead of subtracting it), so this script never
// relies on it for georeferencing.

import { execFile, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { cpus } from 'node:os'
import { basename, extname, join, resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const has = name => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return false
  args.splice(i, 1)
  return true
}

const dpi = Number(flag('dpi', '600'))
const zoom = flag('zoom', '12-17')
const colors = Number(flag('colors', '128'))
const keep = has('keep')
const [input, outArg] = args
const panmap = process.env.PANMAP
const workers = Math.max(1, cpus().length)

if (!input || !outArg || !panmap) {
  console.error('Usage: PANMAP=<panmap>/dist/cli/main.js node scripts/map-tiles.mjs <map.omap|map.ocd> <outDir> [--dpi 600] [--zoom 12-17] [--colors 128] [--keep]')
  process.exit(1)
}

const outDir = resolve(outArg)
const work = join(outDir, 'work')
mkdirSync(work, { recursive: true })
const name = basename(input, extname(input)).replace(/[^\w.-]+/g, '_')

const run = (cmd, argv, opts = {}) => {
  const t = Date.now()
  const out = execFileSync(cmd, argv, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 26, ...opts })
  console.log(`  ${basename(cmd)} ${((Date.now() - t) / 1000).toFixed(1)} s`)
  return out.toString()
}

// 1. Normalise to .omap so georeferencing can be read from one format.
let omap = resolve(input)
if (extname(input).toLowerCase() === '.ocd') {
  console.log('Converting .ocd -> .omap')
  omap = join(work, `${name}.omap`)
  run('node', [panmap, 'convert', resolve(input), omap])
}

// 2. Georeferencing (Mapper semantics, see Georeferencing::updateTransformation).
const xml = readFileSync(omap, 'utf8')
const geoBlock = xml.match(/<georeferencing\b[\s\S]*?<\/georeferencing>/)?.[0]
if (!geoBlock) throw new Error('Map has no <georeferencing> block')
const attr = (src, a) => {
  const m = src.match(new RegExp(`\\b${a}="([^"]*)"`))
  return m ? Number(m[1]) : undefined
}
const geoTag = geoBlock.match(/<georeferencing\b[^>]*>/)[0]
const scaleDenominator = attr(geoTag, 'scale')
const auxFactor = attr(geoTag, 'auxiliary_scale_factor') ?? attr(geoTag, 'grid_scale_factor') ?? 1
const grivationDeg = attr(geoTag, 'grivation') ?? 0
const projected = geoBlock.match(/<projected_crs\b[\s\S]*?<\/projected_crs>/)?.[0] ?? ''
const epsg = projected.match(/epsg:(\d+)/i)?.[1] ?? projected.match(/<parameter>(\d+)<\/parameter>/)?.[1]
const refTag = projected.match(/<ref_point\b[^>]*>/)?.[0]
const mapRefTag = geoBlock.match(/<map_ref_point\b[^>]*>/)?.[0]
const latlon = geoBlock.match(/<ref_point_deg\b[^>]*>/)?.[0]
if (!scaleDenominator || !epsg || !refTag) throw new Error('Incomplete georeferencing (need scale, EPSG and ref_point)')
const refE = attr(refTag, 'x')
const refN = attr(refTag, 'y')
const mapRefX = mapRefTag ? attr(mapRefTag, 'x') : 0 // µm, y down
const mapRefY = mapRefTag ? attr(mapRefTag, 'y') : 0

// Grid scale factor at the ref point; Mapper's combined factor = grid × auxiliary.
let gridFactor = 1
if (latlon) {
  const out = execFileSync('proj', ['-S', `EPSG:${epsg}`], {
    input: `${attr(latlon, 'lon')} ${attr(latlon, 'lat')}\n`,
  }).toString()
  gridFactor = Number(out.match(/<([\d.]+)/)?.[1] ?? 1)
}
const combined = gridFactor * auxFactor
console.log(`Georef: EPSG:${epsg} 1:${scaleDenominator} ref ${refE},${refN} grivation ${grivationDeg}° combined scale ${combined.toFixed(7)} (grid ${gridFactor} × aux ${auxFactor})`)

// 3. SVG (viewBox in 0.01 mm paper units, y down; = omap µm / 10).
console.log('Exporting SVG')
const svg = join(work, `${name}.svg`)
run('node', [panmap, 'export', omap, svg, '--white-background'])
const vb = readFileSync(svg, 'utf8').slice(0, 4096).match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number)
const [u0, v0, uw, vh] = vb

// 4. Rasterise.
const widthPx = Math.round(((uw / 100) / 25.4) * dpi)
console.log(`Rasterising ${widthPx} px wide (${dpi} dpi)`)
const png = join(work, `${name}.png`)
run('rsvg-convert', ['-w', String(widthPx), '-o', png, svg])
const info = JSON.parse(run('gdalinfo', ['-json', png]))
const [W, H] = info.size

// 5. World file: pixel centre -> projected metres.
// SVG unit u -> map µm 10u. Mapper: P = ref + R(-g) · diag(s, -s) · (m - mapRef),
// s = combined · scale / 1e6 (m per µm). Qt rotate(-g): x' = x cos g + y sin g, y' = -x sin g + y cos g.
const g = (grivationDeg * Math.PI) / 180
const s = (combined * scaleDenominator) / 1e6
const toProjected = (u, v) => {
  const x = s * (u * 10 - mapRefX)
  const y = -s * (v * 10 - mapRefY)
  return [refE + x * Math.cos(g) + y * Math.sin(g), refN - x * Math.sin(g) + y * Math.cos(g)]
}
const du = uw / W
const dv = vh / H
const [c0E, c0N] = toProjected(u0 + du / 2, v0 + dv / 2)
const [c1E, c1N] = toProjected(u0 + du * 1.5, v0 + dv / 2)
const [r1E, r1N] = toProjected(u0 + du / 2, v0 + dv * 1.5)
const wld = [c1E - c0E, c1N - c0N, r1E - c0E, r1N - c0N, c0E, c0N].map(n => n.toFixed(6)).join('\n')
writeFileSync(join(work, `${name}.pgw`), wld + '\n')
console.log(`Pixel size ${Math.hypot(c1E - c0E, c1N - c0N).toFixed(3)} m`)

// 6. GeoTIFF (keeps the original raster, useful for PDF crops later) + tiles.
const tif = join(outDir, `${name}.tif`)
run('gdal_translate', ['-q', '-a_srs', `EPSG:${epsg}`, '-of', 'COG', '-co', 'COMPRESS=DEFLATE', '-co', 'BIGTIFF=IF_SAFER', png, tif])
// Reproject explicitly with a proper filter. Left to gdal2tiles, the rotation (grivation) and SWEREF -> Web Mercator
// step goes through a warped VRT with nearest-neighbour sampling, which makes every slanted edge jagged.
// Target: Web Mercator at exactly the max zoom's resolution, aligned to the tile grid (-tap), so the top level is 1:1.
const [, zTop] = zoom.split('-').map(Number)
const res = 156543.03392804097 / 2 ** zTop
const merc = join(work, `${name}-3857.tif`)
console.log(`Warping to EPSG:3857 at ${res.toFixed(4)} m/px (z${zTop})`)
run('gdalwarp', [
  '-q', '-overwrite', '-t_srs', 'EPSG:3857', '-r', 'lanczos', '-tr', String(res), String(res), '-tap',
  '-dstalpha', '-multi', '-wo', 'NUM_THREADS=ALL_CPUS', '-wm', '1024',
  '-co', 'COMPRESS=DEFLATE', '-co', 'TILED=YES', '-co', 'BIGTIFF=IF_SAFER',
  tif, merc,
])

const tiles = join(outDir, 'tiles')
if (existsSync(tiles)) rmSync(tiles, { recursive: true })
console.log(`Tiling z${zoom}`)
run('gdal2tiles.py', [
  '--xyz', '-q', '-p', 'mercator', '-z', zoom, '-r', 'lanczos', '-w', 'none',
  `--processes=${workers}`,
  merc, tiles,
], { stdio: ['ignore', 'pipe', 'inherit'] })

// 6b. 8-bit palette: o-maps have few colours, ~1/3 of the size with no visible difference at 128 colours.
if (colors > 0) {
  const files = readdirSync(tiles, { recursive: true }).filter(f => String(f).endsWith('.png')).map(f => join(tiles, String(f)))
  const t = Date.now()
  const chunk = 200
  const batches = []
  for (let i = 0; i < files.length; i += chunk) batches.push(files.slice(i, i + chunk))
  const quantize = b => new Promise((ok, fail) =>
    execFile('pngquant', ['--force', '--ext', '.png', '--skip-if-larger', '--speed', '3', String(colors), '--', ...b], err =>
      // 98/99: a tile was skipped because quantizing would not make it smaller or good enough; keep the original
      !err || err.code === 98 || err.code === 99 ? ok() : fail(err)))
  let next = 0
  await Promise.all(Array.from({ length: workers }, async () => {
    while (next < batches.length) await quantize(batches[next++])
  }))
  console.log(`  pngquant ${files.length} tiles ${((Date.now() - t) / 1000).toFixed(1)} s`)
}

// 7. Metadata for the viewer.
const corners = [[u0, v0], [u0 + uw, v0], [u0 + uw, v0 + vh], [u0, v0 + vh]].map(([u, v]) => toProjected(u, v))
const ll = execFileSync('gdaltransform', ['-s_srs', `EPSG:${epsg}`, '-t_srs', 'EPSG:4326', '-output_xy'], {
  input: corners.map(c => c.join(' ')).join('\n') + '\n',
}).toString().trim().split('\n').map(l => l.split(/\s+/).map(Number))
const lons = ll.map(p => p[0])
const lats = ll.map(p => p[1])
const [zMin, zMax] = zoom.split('-').map(Number)
writeFileSync(join(outDir, 'map.json'), JSON.stringify({
  name,
  source: basename(input),
  epsg: Number(epsg),
  scale: scaleDenominator,
  grivation: grivationDeg,
  dpi,
  bounds: [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]],
  minZoom: zMin,
  maxZoom: zMax,
  builtAt: new Date().toISOString(),
}, null, 2) + '\n')

if (!keep) rmSync(work, { recursive: true })
console.log(`Done: ${outDir}`)

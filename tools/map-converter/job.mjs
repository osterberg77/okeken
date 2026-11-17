// Cloud Run Job: converts an uploaded orienteering map into XYZ tiles (decision 0025).
//
// Env: MAP_ID, SOURCE_PATH (map_sources/<mapId>/<file>), BUCKET (default okeken.firebasestorage.app),
//      PANMAP (path to panmap's dist/cli/main.js), MAP_TILES_SCRIPT (path to scripts/map-tiles.mjs).
// Started by Function onMapSourceUploaded with MAP_ID and SOURCE_PATH as overrides.
//
// 1. Downloads the source, runs the tile pipeline.
// 2. Uploads tiles to map_tiles/<mapId>/<version>/ with an immutable Cache-Control, and the GeoTIFF to map_rasters/.
// 3. Switches maps/<mapId>.current to the new version, unless a newer upload has taken over the job meanwhile.
// 4. Deletes the previous version's tiles and raster.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const { MAP_ID: mapId, SOURCE_PATH: sourcePath } = process.env
const bucketName = process.env.BUCKET || 'okeken.firebasestorage.app'
const panmap = process.env.PANMAP || '/opt/panmap/dist/cli/main.js'
const script = process.env.MAP_TILES_SCRIPT || '/app/map-tiles.mjs'
const IMMUTABLE = 'public, max-age=31536000, immutable'
const UPLOAD_CONCURRENCY = 32

if (!mapId || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(mapId) || !sourcePath?.startsWith(`map_sources/${mapId}/`)) {
  console.error('MAP_ID and SOURCE_PATH (map_sources/<mapId>/...) are required')
  process.exit(2)
}

initializeApp({ storageBucket: bucketName })
const db = getFirestore()
const bucket = getStorage().bucket()
const mapRef = db.doc(`maps/${mapId}`)

/** True while this run's source is still the latest upload for the map. */
async function stillLatest(tx) {
  const snap = tx ? await tx.get(mapRef) : await mapRef.get()
  return snap.data()?.job?.sourcePath === sourcePath
}

async function setJob(fields) {
  await db.runTransaction(async tx => {
    if (!(await stillLatest(tx))) return
    const update = {}
    for (const [k, v] of Object.entries(fields)) update[`job.${k}`] = v
    tx.update(mapRef, update)
  })
}

async function uploadAll(files, dest, base) {
  let next = 0
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
    while (next < files.length) {
      const rel = files[next++]
      await bucket.upload(join(base, rel), {
        destination: `${dest}/${rel}`,
        resumable: false,
        metadata: { contentType: 'image/png', cacheControl: IMMUTABLE },
      })
    }
  }))
}

const work = mkdtempSync(join(tmpdir(), 'map-'))
const version = randomBytes(12).toString('hex')
const tilePrefix = `map_tiles/${mapId}/${version}`
const rasterPath = `map_rasters/${mapId}/${version}.tif`

try {
  if (!(await stillLatest())) {
    console.log('A newer upload exists; nothing to do')
    process.exit(0)
  }
  await setJob({ status: 'running', startedAt: FieldValue.serverTimestamp() })

  const ext = extname(sourcePath).toLowerCase()
  const local = join(work, `source${ext}`)
  await bucket.file(sourcePath).download({ destination: local })

  const out = join(work, 'out')
  execFileSync('node', [script, local, out], { stdio: 'inherit', env: { ...process.env, PANMAP: panmap } })
  const meta = JSON.parse(readFileSync(join(out, 'map.json'), 'utf8'))

  const tilesDir = join(out, 'tiles')
  const files = readdirSync(tilesDir, { recursive: true }).map(String).filter(f => f.endsWith('.png'))
  const t = Date.now()
  await uploadAll(files, tilePrefix, tilesDir)
  console.log(`Uploaded ${files.length} tiles in ${((Date.now() - t) / 1000).toFixed(0)} s`)
  await bucket.upload(join(out, `${basename(local, ext)}.tif`), {
    destination: rasterPath,
    metadata: { contentType: 'image/tiff' },
  })

  const previous = await db.runTransaction(async tx => {
    const snap = await tx.get(mapRef)
    const data = snap.data()
    if (data?.job?.sourcePath !== sourcePath) return null // a newer upload took over: discard this version
    tx.update(mapRef, {
      current: {
        version,
        bounds: meta.bounds.flat(), // [s, w, n, e]; Firestore has no nested arrays
        minZoom: meta.minZoom,
        maxZoom: meta.maxZoom,
        scale: meta.scale,
        sourceName: data.job.sourceName ?? basename(sourcePath),
        sourcePath, // members download the original from here
        builtAt: FieldValue.serverTimestamp(),
      },
      'job.status': 'done',
      'job.error': FieldValue.delete(),
      'job.finishedAt': FieldValue.serverTimestamp(),
    })
    return { version: data.current?.version ?? null }
  })

  if (previous === null) {
    console.log('A newer upload took over; removing this version')
    await bucket.deleteFiles({ prefix: `${tilePrefix}/` })
    await bucket.file(rasterPath).delete({ ignoreNotFound: true })
  } else if (previous.version && previous.version !== version) {
    await bucket.deleteFiles({ prefix: `map_tiles/${mapId}/${previous.version}/` })
    await bucket.file(`map_rasters/${mapId}/${previous.version}.tif`).delete({ ignoreNotFound: true })
  }
  console.log(`Done: ${mapId} -> ${version}`)
} catch (err) {
  console.error(err)
  const message = String(err?.message ?? err).slice(0, 500)
  await setJob({ status: 'failed', error: message, finishedAt: FieldValue.serverTimestamp() }).catch(() => {})
  await bucket.deleteFiles({ prefix: `${tilePrefix}/` }).catch(() => {})
  process.exitCode = 1
} finally {
  rmSync(work, { recursive: true, force: true })
}

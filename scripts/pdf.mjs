// Convierte un PDF a MusicXML con Audiveris: npm run pdf -- pieza.pdf [--coleccion] [--paginas 1-2,3-5]
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { exportedFiles, fallbackTitle, parseRanges, sheetsArg, titleFromXml, workFileName } from './collection.mjs'

const OUTPUT = 'scores'
const USAGE = 'Uso: npm run pdf -- pieza.pdf [--coleccion] [--paginas 1-2,3-5]'

function fail(message) {
  console.error(message)
  process.exit(1)
}

function audiveris(pdf, output, sheets) {
  // -sheets toma todo lo que le sigue, así que va antes de otra opción.
  const args = ['-batch', '-transcribe', '-export', ...(sheets ? ['-sheets', sheets] : []), '-output', `${output}/`, pdf]
  const run = spawnSync('audiveris', args, { stdio: 'inherit' })
  if (run.error) fail('No se encontró Audiveris: https://github.com/audiveris/audiveris')
  if (run.status) process.exit(run.status)
}

/** Audiveris puede dejar los archivos en una subcarpeta por libro. */
function findExported(dir, radix) {
  const paths = readdirSync(dir, { recursive: true, encoding: 'utf8' }).map((p) => join(dir, p))
  const byName = new Map(paths.map((p) => [basename(p), p]))
  return exportedFiles([...byName.keys()], radix).map((name) => byName.get(name))
}

function readTitle(path) {
  // ponytail: usa el unzip del sistema; sin él las obras quedan con el nombre genérico.
  const xml = spawnSync('unzip', ['-p', path], { encoding: 'utf8', maxBuffer: 2 ** 28 })
  return xml.status === 0 ? titleFromXml(xml.stdout) : null
}

const entry = (file, index, pages) => {
  const path = join(OUTPUT, file)
  return { file, title: readTitle(path) ?? fallbackTitle(index, pages), ...(pages ? { pages } : {}) }
}

function bySheets(pdf, radix, ranges) {
  return ranges.map((range, i) => {
    // Una carpeta por corrida: si no, cada una pisaría el pieza.mxl de la anterior.
    const tmp = mkdtempSync(join(OUTPUT, '.obra-'))
    try {
      audiveris(pdf, tmp, sheetsArg(range))
      const found = findExported(tmp, radix)
      if (found.length === 0) fail(`Audiveris no exportó nada para las páginas ${sheetsArg(range)}.`)
      if (found.length > 1) console.warn(`Las páginas ${sheetsArg(range)} dieron ${found.length} obras: uso la primera.`)
      const file = workFileName(radix, i)
      renameSync(found[0], join(OUTPUT, file))
      return entry(file, i, [range.from, range.to])
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
}

function byMovements(pdf, radix) {
  audiveris(pdf, OUTPUT)
  return findExported(OUTPUT, radix).map((path, i) => {
    const file = basename(path)
    if (dirname(path) !== OUTPUT) renameSync(path, join(OUTPUT, file)) // junto al manifiesto
    return entry(file, i)
  })
}

let parsed
try {
  parsed = parseArgs({ allowPositionals: true, options: { coleccion: { type: 'boolean' }, paginas: { type: 'string' } } })
} catch {
  fail(USAGE)
}
const { values, positionals } = parsed
const [pdf] = positionals
if (!pdf) fail(USAGE)

let ranges = null
try {
  if (values.paginas) ranges = parseRanges(values.paginas)
} catch (err) {
  fail(err.message)
}

mkdirSync(OUTPUT, { recursive: true })
const radix = basename(pdf).replace(/\.pdf$/i, '')
const obras = ranges ? bySheets(pdf, radix, ranges) : byMovements(pdf, radix)

if (obras.length > 1 || ranges || values.coleccion) {
  if (obras.length === 1 && !ranges) console.warn('Audiveris no detectó cortes: marcalos con --paginas 1-2,3-5.')
  const manifest = join(OUTPUT, `${radix}.coleccion.json`)
  writeFileSync(manifest, `${JSON.stringify({ title: radix, pdfName: basename(pdf), obras }, null, 2)}\n`)
  console.log(`Colección de ${obras.length} obras en ${manifest}. Cargá ese archivo junto con sus .mxl.`)
}

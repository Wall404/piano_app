import type { Collection, Score } from '../model/types'
import { importFile } from '.'

export const MANIFEST_RE = /\.coleccion\.json$/i

export interface Manifest {
  title: string
  pdfName: string
  obras: { file: string; title?: string; pages?: [number, number] }[]
}

export function parseManifest(text: string): Manifest {
  let data: Partial<Manifest> | null = null
  try {
    data = JSON.parse(text)
  } catch {
    // cae en el error de abajo
  }
  if (!data || typeof data.title !== 'string' || !Array.isArray(data.obras) || data.obras.some((o) => typeof o?.file !== 'string')) {
    throw new Error('El archivo .coleccion.json no es válido.')
  }
  return { pdfName: '', ...data, title: data.title, obras: data.obras }
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '')

/** Parte común de los nombres, para titular una colección sin manifiesto. */
export function commonTitle(names: string[]) {
  const bases = names.map(baseName)
  let prefix = bases[0]
  for (const name of bases) {
    while (!name.startsWith(prefix)) prefix = prefix.slice(0, -1)
  }
  return prefix.replace(/\.?(obra|mvt)?[\s._-]*$/i, '') || `Colección de ${names.length} obras`
}

/** Decide qué archivos forman la colección y en qué orden, antes de leer ninguno. */
export function planCollection(names: string[], manifest: Manifest | null) {
  if (manifest) {
    const missing = manifest.obras.filter((o) => !names.includes(o.file)).map((o) => o.file)
    if (missing.length) throw new Error(`Faltan archivos de la colección: ${missing.join(', ')}.`)
    return { title: manifest.title, pdfName: manifest.pdfName, obras: manifest.obras }
  }
  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  return { title: commonTitle(sorted), pdfName: '', obras: sorted.map((file) => ({ file } as Manifest['obras'][number])) }
}

export async function importCollection(files: File[]) {
  const manifestFile = files.find((f) => MANIFEST_RE.test(f.name))
  const manifest = manifestFile ? parseManifest(await manifestFile.text()) : null
  const works = files.filter((f) => f !== manifestFile)
  const plan = planCollection(works.map((f) => f.name), manifest)

  const stamp = Date.now()
  const collectionId = `${stamp}-${plan.title}`
  const items: { score: Score; file: File }[] = []
  // Primero se leen todas: si una falla no queda una colección a medias.
  for (const obra of plan.obras) {
    const file = works.find((f) => f.name === obra.file)!
    const score = await importFile(file)
    items.push({
      file,
      score: {
        ...score,
        collectionId,
        title: obra.title ?? score.title,
        ...(obra.pages ? { pages: obra.pages } : {}),
      },
    })
  }
  const collection: Collection = {
    id: collectionId,
    title: plan.title,
    pdfName: plan.pdfName,
    scoreIds: items.map((i) => i.score.id),
  }
  return { collection, items }
}

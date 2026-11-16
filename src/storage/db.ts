import { del, entries, get, set, update } from 'idb-keyval'
import type { CalibrationProfile } from '../eval/calibrate'
import type { ChordTestRecord } from '../eval/chordTest'
import type { Result } from '../eval/match'
import { importFile } from '../import'
import { mergeXml, readXml, splitXml } from '../import/xmlEdit'
import type { Collection, MeasureRange, Score } from '../model/types'

export interface StoredScore {
  score: Score
  file?: Blob // original, para dibujar la partitura
  addedAt: string
}

export interface Attempt {
  date: string
  tempoPct: number
  result: Result
}

export interface NamedSection extends MeasureRange {
  name: string
}

export interface ScorePrefs {
  tempoPct: number
  range: MeasureRange | null
  sections: NamedSection[]
}

const SCORE = 'score:'
const ATTEMPTS = 'attempts:'
const PREFS = 'prefs:'
const COLLECTION = 'collection:'
const DEFAULT_PREFS: ScorePrefs = { tempoPct: 100, range: null, sections: [] }

export async function listScores(): Promise<StoredScore[]> {
  const all = await entries<string, StoredScore>()
  return all
    .filter(([key]) => key.startsWith(SCORE))
    .map(([, value]) => value)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
}

export const saveScore = (score: Score, file?: Blob) =>
  set(SCORE + score.id, { score, file, addedAt: new Date().toISOString() })

export async function deleteScore(id: string) {
  await del(SCORE + id)
  await del(ATTEMPTS + id)
  await del(PREFS + id)
}

export const renameScore = (id: string, title: string) =>
  update<StoredScore>(SCORE + id, (stored) => ({ ...stored!, score: { ...stored!.score, title } }))

export async function listCollections(): Promise<Collection[]> {
  const all = await entries<string, Collection>()
  return all.filter(([key]) => key.startsWith(COLLECTION)).map(([, value]) => value)
}

export async function saveCollection(collection: Collection, items: { score: Score; file?: Blob }[]) {
  for (const { score, file } of items) await saveScore(score, file)
  await set(COLLECTION + collection.id, collection)
}

export async function deleteCollection(collection: Collection) {
  await Promise.all(collection.scoreIds.map(deleteScore))
  await del(COLLECTION + collection.id)
}

async function readWork(id: string) {
  const stored = await get<StoredScore>(SCORE + id)
  if (!stored?.file) throw new Error('Solo se pueden editar obras cargadas desde MusicXML.')
  return { score: stored.score, xml: await readXml(stored.file, stored.score.source.fileName) }
}

/** Arma la obra `base` desde MusicXML editado, con otro id y título si hace falta. Todavía no la guarda. */
async function buildWork(base: Score, xml: string, changes: Pick<Score, 'id' | 'title' | 'pages'>) {
  const file = new File([xml], `${base.source.fileName.replace(/\.[^.]+$/, '')}.musicxml`)
  const { pages, ...rest } = changes
  const score: Score = { ...(await importFile(file)), ...rest, collectionId: base.collectionId, ...(pages ? { pages } : {}) }
  return { score, file }
}

/** Une la obra `index` de la colección con la siguiente; la unida conserva el historial de la primera. */
export async function mergeWorks(collection: Collection, index: number) {
  const a = await readWork(collection.scoreIds[index])
  const b = await readWork(collection.scoreIds[index + 1])
  const pages: Score['pages'] = a.score.pages && b.score.pages ? [a.score.pages[0], b.score.pages[1]] : undefined
  const merged = await buildWork(a.score, mergeXml(a.xml, b.xml), { id: a.score.id, title: a.score.title, pages })
  await saveScore(merged.score, merged.file)
  await deleteScore(b.score.id)
  await set(COLLECTION + collection.id, { ...collection, scoreIds: collection.scoreIds.filter((id) => id !== b.score.id) })
}

/** Separa la obra `index` en dos desde el compás `from`; la segunda queda justo después. */
export async function splitWork(collection: Collection, index: number, from: number) {
  const { score, xml } = await readWork(collection.scoreIds[index])
  const [xmlA, xmlB] = splitXml(xml, from)
  // Se importan las dos antes de guardar: si una falla, la obra queda como estaba.
  const first = await buildWork(score, xmlA, { id: score.id, title: score.title })
  const second = await buildWork(score, xmlB, { id: `${Date.now()}-${score.id}`, title: `${score.title} (2)` })
  await saveScore(first.score, first.file)
  await saveScore(second.score, second.file)
  await del(PREFS + score.id) // los rangos y secciones guardados pueden quedar fuera de la obra
  const scoreIds = [...collection.scoreIds]
  scoreIds.splice(index + 1, 0, second.score.id)
  await set(COLLECTION + collection.id, { ...collection, scoreIds })
}

export const listAttempts = async (scoreId: string) => (await get<Attempt[]>(ATTEMPTS + scoreId)) ?? []

export async function saveAttempt(scoreId: string, attempt: Attempt) {
  await set(ATTEMPTS + scoreId, [...(await listAttempts(scoreId)), attempt])
}

export const getPrefs = async (scoreId: string): Promise<ScorePrefs> => ({
  ...DEFAULT_PREFS,
  ...(await get<ScorePrefs>(PREFS + scoreId)),
})

export const savePrefs = (scoreId: string, prefs: Partial<ScorePrefs>) =>
  update<ScorePrefs>(PREFS + scoreId, (old) => ({ ...DEFAULT_PREFS, ...old, ...prefs }))

export const getChordTest = () => get<ChordTestRecord>('chordtest')
export const saveChordTest = (record: ChordTestRecord) => set('chordtest', record)

export const getCalibration = () => get<CalibrationProfile>('calibration')
export const saveCalibration = (profile: CalibrationProfile) => set('calibration', profile)

import { del, entries, get, set, update } from 'idb-keyval'
import type { CalibrationProfile } from '../eval/calibrate'
import type { ChordTestRecord } from '../eval/chordTest'
import type { Result } from '../eval/match'
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

import { del, entries, get, set } from 'idb-keyval'
import type { CalibrationProfile } from '../eval/calibrate'
import type { Result } from '../eval/match'
import type { Score } from '../model/types'

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

const SCORE = 'score:'
const ATTEMPTS = 'attempts:'

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
}

export const listAttempts = async (scoreId: string) => (await get<Attempt[]>(ATTEMPTS + scoreId)) ?? []

export async function saveAttempt(scoreId: string, attempt: Attempt) {
  await set(ATTEMPTS + scoreId, [...(await listAttempts(scoreId)), attempt])
}

export const getCalibration = () => get<CalibrationProfile>('calibration')
export const saveCalibration = (profile: CalibrationProfile) => set('calibration', profile)

import { parseNote } from './notes'
import type { Hand, MeasureRange, NoteEvent, Score } from './types'

export const scoreEnd = (score: Score) => Math.max(...score.notes.map((n) => n.time + n.duration))

export function timeRange(score: Score, range: MeasureRange | null) {
  if (!range) return { start: 0, end: scoreEnd(score) }
  return {
    start: score.measures[range.from - 1].start,
    end: score.measures[range.to]?.start ?? scoreEnd(score),
  }
}

/** Divide la obra en tramos de `size` compases, para elegir sección con un toque. */
export function measureChunks(score: Score, size = 4): MeasureRange[] {
  const count = score.measures.length
  const chunks: MeasureRange[] = []
  for (let from = 1; from <= count; from += size) chunks.push({ from, to: Math.min(from + size - 1, count) })
  return chunks
}

export function measureAt(score: Score, time: number): number {
  let current = 1
  for (const m of score.measures) {
    if (m.start > time) break
    current = m.index
  }
  return current
}

export interface Chord {
  time: number
  notes: NoteEvent[]
}

/** Agrupa las notas que empiezan juntas. Espera `notes` ordenadas por time. */
export function groupChords(notes: NoteEvent[], toleranceSec = 0.02): Chord[] {
  const chords: Chord[] = []
  for (const n of notes) {
    const last = chords.at(-1)
    if (last && n.time - last.time <= toleranceSec) last.notes.push(n)
    else chords.push({ time: n.time, notes: [n] })
  }
  return chords
}

/** Próximo acorde a tocar en el modo espera, sin importar por dónde va el reloj. */
export function nextChord(
  chords: Chord[],
  cleared: number,
  range: { start: number; end: number },
  hands: Record<Hand, boolean>,
): Chord | null {
  for (const c of chords) {
    if (c.time >= range.end) return null
    if (c.time <= cleared || c.time < range.start) continue
    if (c.notes.some((n) => hands[n.hand])) return c
  }
  return null
}

interface TokenScore {
  id: string
  title: string
  composer?: string
  bpm: number
  timeSignature: [number, number]
  right: string[]
  left: string[]
}

/**
 * Partitura escrita a mano en tokens secuenciales:
 * "E4:1" (nota y tiempos), "C3+E3+G3:4" (acorde), "r:1" (silencio).
 */
export function fromTokens(t: TokenScore): Score {
  const beatSec = 60 / t.bpm
  const beatsPerMeasure = t.timeSignature[0]
  const voice = (tokens: string[], hand: Hand) => {
    const notes: NoteEvent[] = []
    let beat = 0
    for (const token of tokens) {
      const [pitch, dur] = token.split(':')
      const beats = Number(dur)
      if (pitch !== 'r') {
        for (const name of pitch.split('+')) {
          notes.push({
            midi: parseNote(name),
            time: beat * beatSec,
            duration: beats * beatSec,
            hand,
            measure: Math.floor(beat / beatsPerMeasure) + 1,
          })
        }
      }
      beat += beats
    }
    return { notes, beats: beat }
  }

  const right = voice(t.right, 'R')
  const left = voice(t.left, 'L')
  const count = Math.ceil(Math.max(right.beats, left.beats) / beatsPerMeasure)
  return {
    id: t.id,
    title: t.title,
    composer: t.composer,
    bpm: t.bpm,
    timeSignature: t.timeSignature,
    measures: Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      start: i * beatsPerMeasure * beatSec,
    })),
    notes: [...right.notes, ...left.notes].sort((a, b) => a.time - b.time || a.midi - b.midi),
    source: { kind: 'builtin', fileName: `${t.id}.ts` },
  }
}

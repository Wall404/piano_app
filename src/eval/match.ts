import type { NoteEvent } from '../model/types'

export interface Played {
  midi: number
  time: number // segundos a tempo original
}

export interface Result {
  total: number
  hits: number
  wrong: number
  missed: number
  avgOffsetMs: number // negativo: adelantado
  errorsByMeasure: Record<number, number>
}

/** Compara lo esperado con lo tocado. No sabe de audio ni de MIDI. */
export function match(expected: NoteEvent[], played: Played[], toleranceSec: number): Result {
  const free = new Set(played)
  const errorsByMeasure: Record<number, number> = {}
  const addError = (measure: number) => {
    errorsByMeasure[measure] = (errorsByMeasure[measure] ?? 0) + 1
  }
  let hits = 0
  let offset = 0

  for (const note of expected) {
    let best: Played | null = null
    for (const p of free) {
      const dt = Math.abs(p.time - note.time)
      if (p.midi === note.midi && dt <= toleranceSec && (!best || dt < Math.abs(best.time - note.time))) best = p
    }
    if (best) {
      free.delete(best)
      hits++
      offset += best.time - note.time
    } else {
      addError(note.measure)
    }
  }

  for (const p of free) {
    const nearest = expected.reduce((a, b) => (Math.abs(b.time - p.time) < Math.abs(a.time - p.time) ? b : a))
    addError(nearest.measure)
  }

  return {
    total: expected.length,
    hits,
    wrong: free.size,
    missed: expected.length - hits,
    avgOffsetMs: hits ? (offset / hits) * 1000 : 0,
    errorsByMeasure,
  }
}

/** Sugiere repasar la ventana de 4 compases con más errores, más lento. */
export function suggestion(result: Result, tempoPct: number, lastMeasure: number): string {
  const measures = Object.keys(result.errorsByMeasure).map(Number)
  if (measures.length === 0) return tempoPct < 150 ? `Sin errores. Probá al ${tempoPct + 5} %.` : 'Sin errores.'
  const inWindow = (from: number) =>
    measures.filter((m) => m >= from && m < from + 4).reduce((sum, m) => sum + result.errorsByMeasure[m], 0)
  const from = measures.reduce((a, b) => (inWindow(b) > inWindow(a) ? b : a))
  const pct = Math.max(25, Math.round((tempoPct * 0.8) / 5) * 5)
  return `Repetí los compases ${from} a ${Math.min(from + 3, lastMeasure)} al ${pct} %.`
}

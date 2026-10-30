export type Hand = 'L' | 'R'

export interface NoteEvent {
  midi: number // 21 (La0) a 108 (Do8)
  time: number // segundos desde el inicio, a tempo original
  duration: number // segundos
  hand: Hand
  measure: number // compás, empieza en 1
  finger?: number // 1 a 5, si la partitura lo trae
}

export interface Score {
  id: string
  title: string
  composer?: string
  bpm: number
  timeSignature: [number, number]
  measures: { index: number; start: number }[] // inicio de cada compás en segundos
  notes: NoteEvent[] // ordenadas por time
  source: { kind: 'musicxml' | 'midi' | 'builtin'; fileName: string }
}

export interface Section {
  id: string
  scoreId: string
  name: string
  fromMeasure: number
  toMeasure: number
}

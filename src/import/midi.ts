import { Midi } from '@tonejs/midi'
import { PIANO_HIGH, PIANO_LOW } from '../model/notes'
import type { Hand, NoteEvent, Score } from '../model/types'

const MIDDLE_C = 60

// ponytail: un solo tempo y compás para los compases; una pieza que cambia de compás numera mal las barras.
export function fromMidi(data: ArrayBuffer, fileName: string): Score {
  const midi = new Midi(data)
  const tracks = midi.tracks.filter((t) => t.notes.length > 0)
  if (tracks.length === 0) throw new Error('El MIDI no tiene notas.')

  const pitch = (t: (typeof tracks)[number]) => t.notes.reduce((sum, n) => sum + n.midi, 0) / t.notes.length
  const right = tracks.reduce((a, b) => (pitch(b) > pitch(a) ? b : a))
  const handOf = (track: (typeof tracks)[number], midiNote: number): Hand => {
    if (tracks.length === 1) return midiNote >= MIDDLE_C ? 'R' : 'L'
    return track === right ? 'R' : 'L'
  }

  const [num, den] = (midi.header.timeSignatures[0]?.timeSignature ?? [4, 4]) as [number, number]
  const measureTicks = (midi.header.ppq * 4 * num) / den
  const notes: NoteEvent[] = tracks
    .flatMap((t) =>
      t.notes.map((n) => ({
        midi: n.midi,
        time: n.time,
        duration: n.duration,
        hand: handOf(t, n.midi),
        measure: Math.floor(n.ticks / measureTicks) + 1,
      })),
    )
    .filter((n) => n.midi >= PIANO_LOW && n.midi <= PIANO_HIGH)
    .sort((a, b) => a.time - b.time || a.midi - b.midi)
  if (notes.length === 0) throw new Error('El MIDI no tiene notas dentro del rango del piano.')

  const count = notes.at(-1)!.measure
  return {
    id: `${Date.now()}-${fileName}`,
    title: midi.name || fileName.replace(/\.[^.]+$/, ''),
    bpm: midi.header.tempos[0]?.bpm ?? 120,
    timeSignature: [num, den],
    measures: Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      start: midi.header.ticksToSeconds(i * measureTicks),
    })),
    notes,
    source: { kind: 'midi', fileName },
  }
}

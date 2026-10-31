import { Midi } from '@tonejs/midi'
import { describe, expect, it } from 'vitest'
import { match, suggestion } from '../src/eval/match'
import { fromMidi } from '../src/import/midi'
import type { NoteEvent } from '../src/model/types'

function midiFile(tracks: number[][]) {
  const midi = new Midi()
  midi.header.setTempo(120)
  for (const pitches of tracks) {
    const track = midi.addTrack()
    pitches.forEach((p, i) => track.addNote({ midi: p, time: i * 0.5, duration: 0.5 }))
  }
  const bytes = midi.toArray()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

describe('importar MIDI', () => {
  it('asigna la pista más aguda a la mano derecha', () => {
    const score = fromMidi(midiFile([[48, 50], [72, 74]]), 'pieza.mid')
    expect(score.notes.filter((n) => n.hand === 'R').map((n) => n.midi)).toEqual([72, 74])
    expect(score.notes.filter((n) => n.hand === 'L').map((n) => n.midi)).toEqual([48, 50])
    expect(score.title).toBe('pieza')
  })

  it('con una sola pista separa las manos en el Do central', () => {
    const score = fromMidi(midiFile([[48, 72]]), 'una.mid')
    expect(score.notes.map((n) => n.hand)).toEqual(['L', 'R'])
  })

  it('numera compases y ordena por tiempo', () => {
    const score = fromMidi(midiFile([[60, 62, 64, 65, 67]]), 'c.mid')
    expect(score.notes.at(-1)?.measure).toBe(2)
    expect(score.measures[1].start).toBeCloseTo(2)
  })

  it('rechaza un MIDI sin notas', () => {
    expect(() => fromMidi(midiFile([]), 'vacio.mid')).toThrow('no tiene notas')
  })
})

describe('evaluación', () => {
  const note = (midi: number, time: number, measure = 1): NoteEvent => ({ midi, time, duration: 0.5, hand: 'R', measure })
  const expected = [note(60, 0), note(62, 1), note(64, 2, 2)]

  it('cuenta aciertos, errores y faltantes dentro de la tolerancia', () => {
    const r = match(expected, [{ midi: 60, time: 0.05 }, { midi: 61, time: 1 }, { midi: 64, time: 2.5 }], 0.2)
    expect([r.hits, r.missed, r.wrong]).toEqual([1, 2, 2])
    expect(r.avgOffsetMs).toBeCloseTo(50)
    expect(r.errorsByMeasure).toEqual({ 1: 2, 2: 2 })
  })

  it('usa cada nota tocada una sola vez', () => {
    const r = match([note(60, 0), note(60, 0.1)], [{ midi: 60, time: 0.05 }], 0.2)
    expect(r.hits).toBe(1)
  })

  it('sugiere la ventana con más errores a menor tempo', () => {
    const r = { total: 10, hits: 5, wrong: 0, missed: 5, avgOffsetMs: 0, errorsByMeasure: { 2: 1, 9: 3, 11: 1 } }
    expect(suggestion(r, 100, 16)).toBe('Repetí los compases 9 a 12 al 80 %.')
    expect(suggestion(r, 100, 10)).toBe('Repetí los compases 9 a 10 al 80 %.')
    expect(suggestion({ ...r, errorsByMeasure: {} }, 70, 16)).toBe('Sin errores. Probá al 75 %.')
  })
})
